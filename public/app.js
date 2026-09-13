const form=document.getElementById("form");
const icon=document.getElementById("icon"), preview=document.getElementById("preview"), noPreview=document.getElementById("noPreview");
const status=document.getElementById("status"), btn=document.getElementById("build");

icon.addEventListener("change",()=>{
  const f=icon.files[0]; if(!f)return;
  preview.src=URL.createObjectURL(f); noPreview.style.display="none";
});
form.addEventListener("submit",async e=>{
  e.preventDefault(); btn.disabled=true; status.className=""; status.textContent="Mengupload project dan memulai build...";
  try{
    const data=new FormData(form);
    const r=await fetch(`${API_BASE}/api/build`,{method:"POST",body:data});
    const raw=await r.text();
    let j; try { j=JSON.parse(raw); } catch { throw new Error(`Server mengembalikan ${r.status} bukan JSON: ${raw.slice(0,300)}`); }
    if(!r.ok||!j.ok) throw new Error(j.error||"Build gagal");
    status.className="ok";
    status.innerHTML=`Build berhasil!<br><br><a href="${API_BASE}${j.download}">📥 Download APK</a>`;
  }catch(err){status.className="err";status.textContent="❌ "+err.message}
  finally{btn.disabled=false}
});