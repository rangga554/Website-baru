import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";

const exec = promisify(execFile);
const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = process.cwd();
const UPLOADS = path.join(ROOT, "uploads");
const BUILDS = path.join(ROOT, "builds");
fs.mkdirSync(UPLOADS, { recursive: true });
fs.mkdirSync(BUILDS, { recursive: true });

const upload = multer({
  dest: UPLOADS,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_, file, cb) =>
    path.extname(file.originalname).toLowerCase() === ".zip"
      ? cb(null, true) : cb(new Error("Hanya file ZIP yang diizinkan"))
});

app.use(express.json());
app.use(express.static(path.join(ROOT, "public")));

function safePackageName(value) {
  if (!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(value))
    throw new Error("Package name tidak valid. Contoh: com.ranstudiolite.myapp");
  return value;
}

function walk(dir) {
  const out=[];
  for (const e of fs.readdirSync(dir,{withFileTypes:true})) {
    const p=path.join(dir,e.name);
    if (e.isDirectory() && ![".git","node_modules","build","dist"].includes(e.name)) out.push(...walk(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

// Prevent Zip Slip when extracting user ZIPs.
async function extractZip(zipFile, dest) {
  const { default: unzipper } = await import("unzipper");
  await new Promise((resolve,reject)=>{
    fs.createReadStream(zipFile).pipe(unzipper.Parse()).on("entry", entry=>{
      const target=path.resolve(dest, entry.path);
      if (!target.startsWith(path.resolve(dest)+path.sep)) {
        entry.autodrain(); reject(new Error("ZIP berisi path tidak aman")); return;
      }
      if (entry.type==="Directory") fs.mkdirSync(target,{recursive:true});
      else { fs.mkdirSync(path.dirname(target),{recursive:true}); entry.pipe(fs.createWriteStream(target)); }
    }).on("close",resolve).on("error",reject);
  });
}

function replaceText(file, replacements) {
  let s=fs.readFileSync(file,"utf8"), changed=false;
  for (const [a,b] of replacements) if(s.includes(a)){s=s.split(a).join(b);changed=true;}
  if(changed) fs.writeFileSync(file,s);
}

function patchAndroid(projectDir, appName, pkg) {
  // Standard Android/Gradle projects.
  const gradleFiles=walk(projectDir).filter(f=>/build\.gradle(\.kts)?$|AndroidManifest\.xml$/.test(path.basename(f)));
  const oldPackages=new Set();

  for(const f of gradleFiles){
    const s=fs.readFileSync(f,"utf8");
    for(const m of s.matchAll(/(?:namespace|applicationId)\s*[=(]\s*["']([^"']+)["']/g)) oldPackages.add(m[1]);
    for(const m of s.matchAll(/package\s*=\s*["']([^"']+)["']/g)) oldPackages.add(m[1]);
  }
  const old=[...oldPackages].sort((a,b)=>b.length-a.length);
  for(const f of gradleFiles){
    let s=fs.readFileSync(f,"utf8");
    for(const p of old) s=s.split(p).join(pkg);
    if(path.basename(f)==="AndroidManifest.xml"){
      s=s.replace(/android:label="[^"]*"/g,`android:label="${appName.replaceAll('"','')}"`);
    }
    fs.writeFileSync(f,s);
  }

  // Update common string resources.
  for(const f of walk(projectDir).filter(f=>path.basename(f)==="strings.xml")){
    replaceText(f, [[/<string name="app_name">[^<]*<\/string>/, `<string name="app_name">${appName.replaceAll("&","&amp;").replaceAll("<","&lt;")}</string>`]]);
  }

  // If source contains package declarations, replace discovered old package.
  for(const f of walk(projectDir).filter(f=>/\.(java|kt|xml)$/.test(f))){
    let s=fs.readFileSync(f,"utf8");
    for(const p of old) s=s.split(`package ${p}`).join(`package ${pkg}`);
    fs.writeFileSync(f,s);
  }
}

function patchIcon(projectDir, iconFile) {
  if(!iconFile) return;
  const res=walk(projectDir).find(f=>/\/src\/main\/res\/drawable[^/]*$/.test(path.dirname(f)));
  const candidates=walk(projectDir).filter(f=>/\/mipmap[^/]*\//.test(f) && /\.(png|webp|jpg|jpeg)$/.test(f));
  const targets=candidates.filter(f=>/^ic_launcher/.test(path.basename(f)));
  for(const t of targets) fs.copyFileSync(iconFile,t);
  if(!targets.length) {
    const dir=path.join(projectDir,"app","src","main","res","mipmap-hdpi");
    fs.mkdirSync(dir,{recursive:true});
    fs.copyFileSync(iconFile,path.join(dir,"ic_launcher.png"));
  }
}

app.post("/api/build", upload.fields([{name:"repo",maxCount:1},{name:"icon",maxCount:1}]), async (req,res)=>{
  const job=crypto.randomUUID();
  const work=path.join(os.tmpdir(),"apk-builder-"+job);
  try{
    const repo=req.files?.repo?.[0];
    if(!repo) throw new Error("ZIP project belum dipilih");
    const appName=String(req.body.appName||"My App").trim().slice(0,60);
    const pkg=safePackageName(String(req.body.packageName||"com.example.myapp").trim());
    fs.mkdirSync(work,{recursive:true});
    await extractZip(repo.path,work);

    // Handle ZIPs that contain a single top-level project folder.
    let project=work;
    const entries=fs.readdirSync(work);
    if(entries.length===1 && fs.statSync(path.join(work,entries[0])).isDirectory()) project=path.join(work,entries[0]);

    patchAndroid(project,appName,pkg);
    patchIcon(project,req.files?.icon?.[0]?.path);

    // Build only known Gradle Android projects. Gradle wrapper is preferred.
    const gradlew=process.platform==="win32"?"gradlew.bat":"gradlew";
    const wrapper=path.join(project,gradlew);
    if(!fs.existsSync(wrapper)) throw new Error("Project tidak memiliki Gradle Wrapper (gradlew). Tambahkan wrapper Android/Gradle agar bisa dibuild.");

    if(process.platform!=="win32") fs.chmodSync(wrapper,0o755);
    await exec(wrapper,["assembleDebug","--no-daemon","--stacktrace"],{cwd:project,timeout:15*60*1000,maxBuffer:20*1024*1024});

    const apkCandidates=walk(project).filter(f=>f.endsWith(".apk")).sort((a,b)=>fs.statSync(b).mtimeMs-fs.statSync(a).mtimeMs);
    if(!apkCandidates.length) throw new Error("Build selesai tetapi APK tidak ditemukan.");
    const out=path.join(BUILDS,job+"-"+appName.replace(/[^a-z0-9_-]/gi,"_")+".apk");
    fs.copyFileSync(apkCandidates[0],out);
    res.json({ok:true,job,download:"/api/download/"+path.basename(out)});
  }catch(e){
    console.error(e);
    res.status(400).json({ok:false,error:e.message||"Build gagal"});
  }finally{
    try{ if(req.files?.repo?.[0]) fs.unlinkSync(req.files.repo[0].path); }catch{}
    try{ if(req.files?.icon?.[0]) fs.unlinkSync(req.files.icon[0].path); }catch{}
    fs.rmSync(work,{recursive:true,force:true});
  }
});

app.get("/api/download/:file", (req,res)=>{
  const file=path.basename(req.params.file);
  const p=path.join(BUILDS,file);
  if(!fs.existsSync(p)) return res.status(404).send("APK tidak ditemukan");
  res.download(p,file);
});

app.get("*",(_,res)=>res.sendFile(path.join(ROOT,"public/index.html")));
app.listen(PORT,()=>console.log(`APK Builder berjalan di http://localhost:${PORT}`));