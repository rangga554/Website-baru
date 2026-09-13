"use client";
import { useEffect, useState } from "react";
let cache:Set<string>|null=null; let inflight:Promise<Set<string>>|null=null;
function fetchLogins(){if(cache)return Promise.resolve(cache);if(inflight)return inflight;inflight=fetch("/api/developers/public").then(r=>r.json()).then((d:{logins:string[]})=>{cache=new Set(d.logins||[]);return cache}).catch(()=>new Set<string>()).finally(()=>{inflight=null});return inflight}
export function useDeveloperLogins(){const [logins,setLogins]=useState<Set<string>>(cache||new Set());useEffect(()=>{fetchLogins().then(setLogins)},[]);return logins}
