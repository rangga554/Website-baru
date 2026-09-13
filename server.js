import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import sharp from "sharp";
import unzipper from "unzipper";

const exec = promisify(execFile);
const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = process.cwd();
const TMP = path.join(os.tmpdir(), "zip-apk-builder");
const BUILDS = path.join(TMP, "builds");
fs.mkdirSync(BUILDS, { recursive: true });

const upload = multer({
  dest: TMP,
  limits: { fileSize: 500 * 1024 * 1024, files: 2 }
});

app.use((req,res,next)=>{ res.setHeader("Access-Control-Allow-Origin", "*"); res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS"); res.setHeader("Access-Control-Allow-Headers", "Content-Type"); if(req.method === "OPTIONS") return res.sendStatus(204); next(); });
app.use(express.json());
app.use(express.static(path.join(ROOT, "public")));
app.get("/health", (_,res)=>res.json({ok:true,service:"zip-apk-builder"}));

function safePackageName(value) {
  if (!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(value)) {
    throw new Error("Package name tidak valid. Contoh: com.ranstudiolite.myapp");
  }
  return value;
}

function safeAppName(value) {
  const v = String(value || "My App").trim().slice(0, 60);
  if (!v) throw new Error("Nama aplikasi kosong.");
  return v;
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && ![".git", "node_modules", ".gradle", "build", "dist"].includes(e.name)) {
      out.push(...walk(p));
    } else if (e.isFile()) out.push(p);
  }
  return out;
}

async function extractZip(zipFile, dest) {
  await fs.promises.mkdir(dest, { recursive: true });
  const directory = await unzipper.Open.file(zipFile);
  for (const entry of directory.files) {
    const normalized = entry.path.replaceAll("\\\\", "/");
    if (normalized.startsWith("/") || normalized.split("/").includes("..")) {
      throw new Error("ZIP berisi path tidak aman.");
    }
    const target = path.resolve(dest, normalized);
    if (!target.startsWith(path.resolve(dest) + path.sep)) {
      throw new Error("ZIP berisi path tidak aman.");
    }
    if (entry.type === "Directory") {
      await fs.promises.mkdir(target, { recursive: true });
    } else {
      await fs.promises.mkdir(path.dirname(target), { recursive: true });
      await new Promise((resolve, reject) => {
        entry.stream().pipe(fs.createWriteStream(target))
          .on("finish", resolve).on("error", reject);
      });
    }
  }
}

function findProjectRoot(extracted) {
  const hasGradle = (d) => fs.existsSync(path.join(d, "gradlew")) || fs.existsSync(path.join(d, "gradlew.bat"));
  if (hasGradle(extracted)) return extracted;
  const dirs = fs.readdirSync(extracted, { withFileTypes: true }).filter(x => x.isDirectory());
  const candidates = dirs.map(x => path.join(extracted, x.name)).filter(hasGradle);
  if (candidates.length === 1) return candidates[0];
  throw new Error("ZIP bukan project Android/Gradle yang memiliki Gradle Wrapper (gradlew).");
}

function xmlEscape(s) {
  return s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}

function patchAndroid(projectDir, appName, newPkg) {
  const files = walk(projectDir).filter(f =>
    /build\.gradle(\.kts)?$|settings\.gradle(\.kts)?$|AndroidManifest\.xml$|strings\.xml$/.test(path.basename(f))
  );

  const oldPackages = new Set();
  for (const f of files) {
    let s = fs.readFileSync(f, "utf8");
    for (const m of s.matchAll(/(?:namespace|applicationId|applicationIdSuffix)\s*[=(]\s*["']([^"']+)["']/g)) {
      if (m[1].includes(".")) oldPackages.add(m[1]);
    }
    for (const m of s.matchAll(/package\s*=\s*["']([^"']+)["']/g)) {
      if (m[1].includes(".")) oldPackages.add(m[1]);
    }
  }
  const old = [...oldPackages].sort((a,b)=>b.length-a.length);

  for (const f of walk(projectDir).filter(f => /\.(java|kt|xml|gradle|kts)$/.test(f))) {
    let s = fs.readFileSync(f, "utf8");
    for (const p of old) {
      s = s.split(`package ${p}`).join(`package ${newPkg}`);
      s = s.split(`"${p}"`).join(`"${newPkg}"`);
      s = s.split(`'${p}'`).join(`'${newPkg}'`);
    }
    if (path.basename(f) === "AndroidManifest.xml") {
      s = s.replace(/android:label="[^"]*"/g, `android:label="${xmlEscape(appName)}"`);
    }
    if (path.basename(f) === "strings.xml") {
      s = s.replace(/<string\s+name=["']app_name["'][^>]*>[\s\S]*?<\/string>/,
        `<string name="app_name">${xmlEscape(appName)}</string>`);
    }
    fs.writeFileSync(f, s);
  }
}

async function patchIcon(projectDir, iconFile) {
  if (!iconFile) return;
  const res = path.join(projectDir, "app", "src", "main", "res");
  const dirs = ["mipmap-mdpi","mipmap-hdpi","mipmap-xhdpi","mipmap-xxhdpi","mipmap-xxxhdpi"];
  const sizes = { "mipmap-mdpi":48, "mipmap-hdpi":72, "mipmap-xhdpi":96, "mipmap-xxhdpi":144, "mipmap-xxxhdpi":192 };
  for (const d of dirs) {
    const dir = path.join(res,d);
    await fs.promises.mkdir(dir,{recursive:true});
    const size=sizes[d];
    await sharp(iconFile).resize(size,size,{fit:"cover"}).png().toFile(path.join(dir,"ic_launcher.png"));
    await sharp(iconFile).resize(size,size,{fit:"cover"}).png().toFile(path.join(dir,"ic_launcher_round.png"));
  }
}

function findApk(projectDir) {
  return walk(projectDir).filter(f => /\/build\/outputs\/apk\/.*\.apk$/.test(f.replaceAll("\\","/")))
    .sort((a,b)=>fs.statSync(b).mtimeMs-fs.statSync(a).mtimeMs)[0];
}

app.post("/api/build", upload.fields([
  {name:"repo",maxCount:1},{name:"icon",maxCount:1}
]), async (req,res) => {
  const job = crypto.randomUUID();
  const work = path.join(TMP, job);
  try {
    const repo=req.files?.repo?.[0];
    if(!repo) throw new Error("Project ZIP belum dipilih.");
    const appName=safeAppName(req.body?.appName);
    const pkg=safePackageName(String(req.body?.packageName||"com.example.myapp").trim());

    await extractZip(repo.path, work);
    const project=findProjectRoot(work);
    patchAndroid(project,appName,pkg);
    await patchIcon(project,req.files?.icon?.[0]?.path);

    const gradlew=process.platform==="win32"?"gradlew.bat":"gradlew";
    const wrapper=path.join(project,gradlew);
    if(process.platform!=="win32") await fs.promises.chmod(wrapper,0o755);

    const result=await exec(wrapper,["assembleDebug","--no-daemon"],{
      cwd:project, timeout:20*60*1000, maxBuffer:25*1024*1024
    });
    console.log(result.stdout.slice(-4000));

    const apk=findApk(project);
    if(!apk) throw new Error("Gradle selesai tetapi APK tidak ditemukan.");
    const filename=`${job}-${appName.replace(/[^a-z0-9_-]/gi,"_")}.apk`;
    await fs.promises.copyFile(apk,path.join(BUILDS,filename));
    res.json({ok:true,download:`/api/download/${filename}`});
  } catch(e) {
    console.error(e);
    res.status(400).json({ok:false,error:e?.stderr?.slice(-3000)||e?.message||"Build gagal"});
  } finally {
    for (const f of [...(req.files?.repo||[]),...(req.files?.icon||[])]) {
      try { await fs.promises.unlink(f.path); } catch {}
    }
    try { await fs.promises.rm(work,{recursive:true,force:true}); } catch {}
  }
});

app.get("/api/download/:file", async (req,res) => {
  const file=path.basename(req.params.file);
  const p=path.join(BUILDS,file);
  if(!fs.existsSync(p)) return res.status(404).send("APK tidak ditemukan.");
  res.download(p,file);
});

// Express 5-safe SPA fallback.
app.get("/{*splat}", (_,res)=>res.sendFile(path.join(ROOT,"public","index.html")));

app.listen(PORT,()=>console.log(`ZIP → APK Builder: http://localhost:${PORT}`));
