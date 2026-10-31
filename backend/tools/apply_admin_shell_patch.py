from pathlib import Path
import re

root=Path('/mnt/data/atelier_admin_v2')
store=root/'frontend/components/storefront/storefront.tsx'
css=root/'frontend/app/globals.css'
backend=root/'backend/src/index.ts'

s=store.read_text()
old_start=s.index('function Admin({section,onNavigate,onNotify,onLogout}:any){')
old_end=s.index('\n\nfunction RedirectTo', old_start) if '\n\nfunction RedirectTo' in s[old_start:] else None
if old_end is None:
    # Admin is the last major function before downstream modal in current file; find exact next function
    m=re.search(r'\nfunction \w+\(', s[old_start+20:])
    old_end=old_start+20+m.start()+1 if m else len(s)
print('Admin range',old_start,old_end)

# Preserve everything except the Admin function; use a brace scanner to find exact function end.
def find_fn_end(text, start):
    brace=text.index('{', start)
    depth=0
    in_str=None; esc=False; line_comment=False; block_comment=False
    i=brace
    while i<len(text):
        c=text[i]; n=text[i+1] if i+1<len(text) else ''
        if line_comment:
            if c=='\n': line_comment=False
            i+=1; continue
        if block_comment:
            if c=='*' and n=='/': block_comment=False; i+=2; continue
            i+=1; continue
        if in_str:
            if esc: esc=False
            elif c=='\\': esc=True
            elif c==in_str: in_str=None
            i+=1; continue
        if c=='/' and n=='/': line_comment=True; i+=2; continue
        if c=='/' and n=='*': block_comment=True; i+=2; continue
        if c in ('"',"'",'`'): in_str=c; i+=1; continue
        if c=='{': depth+=1
        elif c=='}':
            depth-=1
            if depth==0: return i+1
        i+=1
    raise RuntimeError('Could not find function end')

admin_end=find_fn_end(s,old_start)

new_admin=r'''function Admin({section,onNavigate,onNotify,onLogout}:any){
  const [authorized,setAuthorized]=useState<boolean|null>(null);
  const [previewOpen,setPreviewOpen]=useState(false);
  const [previewPath,setPreviewPath]=useState("/");
  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
  const [mobileNavOpen,setMobileNavOpen]=useState(false);
  const [stats,setStats]=useState<any>(null);
  const [data,setData]=useState<any[]>([]);
  const [settings,setSettings]=useState<Record<string,any>>({});
  const [pages,setPages]=useState<CmsPage[]>([]);
  const [adminCategories,setAdminCategories]=useState<any[]>([]);
  const [selected,setSelected]=useState<any>(null);
  const [q,setQ]=useState("");
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    api<{user:User}>("/auth/admin/me").then(r=>{if(r.user.role!=="ADMIN")throw 0;setAuthorized(true)}).catch(()=>setAuthorized(false));
    try{setSidebarCollapsed(localStorage.getItem("atelier_admin_sidebar_collapsed")==="1")}catch{}
  },[]);
  useEffect(()=>{try{localStorage.setItem("atelier_admin_sidebar_collapsed",sidebarCollapsed?"1":"0")}catch{}},[sidebarCollapsed]);
  useEffect(()=>{setMobileNavOpen(false)},[section]);
  useEffect(()=>{
    if(!authorized)return;
    (async()=>{try{
      if(section==="dashboard")setStats(await api("/admin/stats"));
      if(section==="users"){const v=await api<any>(`/admin/users${q?`?q=${encodeURIComponent(q)}`:""}`);setData(Array.isArray(v)?v:[])}
      if(section==="orders"){const v=await api<any>("/admin/orders");setData(Array.isArray(v)?v:[])}
      if(section==="payments"){const v=await api<any>("/admin/payments");setData(Array.isArray(v)?v:[])}
      if(section==="products"){const [v,c]=await Promise.all([api<any>("/admin/products"),api<any>("/admin/categories")]);setData(Array.isArray(v)?v:[]);setAdminCategories(Array.isArray(c)?c:[])}
      if(section==="categories"){const v=await api<any>("/admin/categories");setData(Array.isArray(v)?v:[])}
      if(section==="builder"){const [v,st]=await Promise.all([api<any>("/admin/pages"),api<any>("/admin/settings")]);setPages(Array.isArray(v)?v:[]);setSettings(st&&typeof st==="object"?st:{})}
      if(section==="settings"){const v=await api<any>("/admin/settings");setSettings(v&&typeof v==="object"?v:{})}
    }catch(e:any){onNotify(errorText(e.message))}})()
  },[authorized,section,q]);

  if(authorized===null)return <div className="empty"><div className="eyebrow">ATELIER</div><h2>Loading…</h2></div>;
  if(!authorized)return <RedirectTo to="/login" onNavigate={onNavigate}/>;

  const tabs:[string,string,IconName][]=[
    ["dashboard","Dashboard","grid"],["products","Products","box"],["orders","Orders","orders"],
    ["payments","Payments","cart"],["users","Users","users"],["categories","Categories","category"],
    ["builder","Site Builder","settings"],["settings","Site Settings","settings"],["audit","Audit","orders"]
  ];
  const selectTab=(x:string)=>{
    setData([]);setSelected(null);
    const defaults:Record<string,string>={dashboard:"/",products:"/shop",orders:"/shop",payments:"/",users:"/",categories:"/collections",builder:"/",settings:"/",audit:"/"};
    setPreviewPath(defaults[x]||"/");
    setMobileNavOpen(false);
    onNavigate(`${ADMIN_ROUTE}?section=${x}`)
  };
  const openPreview=(path:string=previewPath||"/")=>{setPreviewPath(path||"/");setPreviewOpen(true);setMobileNavOpen(false)};
  const doLogout=async()=>{try{await api("/auth/admin/logout",{method:"POST"})}catch{}finally{onLogout()}};
  const updateOrder=async(id:string,status:string)=>{setBusy(true);try{await api(`/admin/orders/${id}`,{method:"PATCH",body:JSON.stringify({status})});setData(data.map(o=>o.id===id?{...o,status}:o));onNotify("Order status updated.")}catch(e:any){onNotify(errorText(e.message))}finally{setBusy(false)}};

  const main=<section className="admin-main">
    {section==="dashboard"&&<><div className="eyebrow">ATELIER Control Room</div><div className="admin-dashboard-head"><div><h1 className="serif" style={{fontSize:54,margin:"8px 0 6px"}}>Dashboard</h1><p className="admin-section-description">Private site operations. Customer-facing navigation never exposes this control room.</p></div><button className="btn dark" onClick={doLogout}>Logout</button></div><div className="stats">{[["Users",stats?.users],["Products",stats?.products],["Categories",stats?.categories],["Orders",stats?.orders],["Revenue",money(stats?.revenue||0)],["Low Stock",stats?.lowStock||0]].map(([l,v])=><div className="stat-card" key={String(l)}><span>{l}</span><b>{v}</b></div>)}</div><div className="checkout-card" style={{marginTop:30}}><h3>Admin controls</h3><p className="muted">Products, categories, order operations, users, payments visibility, and site content are managed from this control room.</p></div></>}
    {section==="products"&&<AdminProducts data={data} categories={adminCategories} onNotify={onNotify} onPreview={openPreview}/>} 
    {section==="categories"&&<AdminCategories data={data} onNotify={onNotify} onPreview={openPreview}/>} 
    {section==="users"&&<AdminPageFrame eyebrow="Customer directory" title="Users" description="Customer accounts and roles. Select a row to inspect the full profile." count={data.length} actions={<input className="admin-search" placeholder="Search name / email / phone" value={q} onChange={e=>setQ(e.target.value)}/>}><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Mobile</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead><tbody>{data.length?data.map(u=><tr key={u.id} onClick={async()=>setSelected(await api(`/admin/users/${u.id}`))} style={{cursor:"pointer"}}><td><strong>{u.name}</strong></td><td>{u.email}</td><td>{u.phone||"—"}</td><td><span className={`admin-badge ${u.role==="ADMIN"?"admin-badge-dark":""}`}>{u.role}</span>{u.blockedAt&&<span className="admin-badge admin-badge-danger" style={{marginLeft:6}}>BLOCKED</span>}</td><td>{new Date(u.createdAt).toLocaleDateString()}</td><td>{u.role!=="ADMIN"&&<div className="admin-row-actions"><button className="btn text" onClick={async e=>{e.stopPropagation();const name=prompt("Customer name",u.name);if(!name)return;const phone=prompt("Mobile",u.phone||"")??u.phone;try{const out=await api<any>(`/admin/users/${u.id}`,{method:"PATCH",body:JSON.stringify({name,phone})});setData(v=>v.map(x=>x.id===out.id?{...x,...out}:x));onNotify("User updated.")}catch(err:any){onNotify(errorText(err.message))}}}>Edit</button><button className="btn text" onClick={async e=>{e.stopPropagation();if(!confirm("Block this customer? Their email, phone and known addresses will remain blocked."))return;try{await api(`/admin/users/${u.id}/block`,{method:"POST",body:JSON.stringify({reason:"ADMIN_BLOCK"})});setData(v=>v.map(x=>x.id===u.id?{...x,blockedAt:new Date().toISOString()}:x));onNotify("Customer blocked.")}catch(err:any){onNotify(errorText(err.message))}}} disabled={Boolean(u.blockedAt)}>{u.blockedAt?"Blocked":"Block"}</button>{u.blockedAt&&<button className="btn text" onClick={async e=>{e.stopPropagation();if(!confirm("Unblock this customer? They will be able to log in and register again."))return;try{await api(`/admin/users/${u.id}/unblock`,{method:"POST"});setData(v=>v.map(x=>x.id===u.id?{...x,blockedAt:null}:x));onNotify("Customer unblocked.")}catch(err:any){onNotify(errorText(err.message))}}}>Unblock</button>}<button className="btn text danger-text" onClick={async e=>{e.stopPropagation();if(!confirm("Delete this customer permanently and block their known identity?"))return;try{await api(`/admin/users/${u.id}`,{method:"DELETE"});setData(v=>v.filter(x=>x.id!==u.id));onNotify("Customer deleted and blocked.")}catch(err:any){onNotify(errorText(err.message))}}}>Delete</button></div>}</td></tr>):<tr><td colSpan={6}><div className="admin-empty">No users yet.</div></td></tr>}</tbody></table></div></AdminPageFrame>}
    {section==="orders"&&<AdminPageFrame eyebrow="Payments & fulfilment" title="Orders" description="Order lifecycle, customer details, payment state and fulfilment status." count={data.length}><div className="admin-table-wrap"><table className="admin-table admin-table-orders"><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead><tbody>{data.length?data.map(o=><tr key={o.id}><td><strong>{o.orderNumber}</strong><div className="muted">{new Date(o.createdAt).toLocaleString()}</div></td><td><strong>{o.user?.name||"Customer"}</strong><div className="muted">{o.user?.email||"—"}<br/>{o.user?.phone||"—"}</div></td><td>{(Array.isArray(o.items)?o.items:[]).map((i:any)=><div className="admin-line-item" key={i.id}>{i.productName} <span>× {i.quantity}</span></div>)}</td><td><strong>{money(o.total)}</strong></td><td><span className={`admin-badge ${o.paymentStatus==="CAPTURED"?"admin-badge-success":""}`}>{o.paymentStatus}</span></td><td><select value={o.status} onChange={e=>updateOrder(o.id,e.target.value)} disabled={busy} className="admin-status-select"><option>PAID</option><option>PROCESSING</option><option>SHIPPED</option><option>DELIVERED</option><option>CANCELLED</option><option>REFUNDED</option></select></td></tr>):<tr><td colSpan={6}><div className="admin-empty"><strong>No orders yet.</strong><span>Orders will appear here after the first completed purchase.</span></div></td></tr>}</tbody></table></div></AdminPageFrame>}
    {section==="payments"&&<AdminPayments data={data}/>} 
    {section==="builder"&&<SiteBuilder settings={settings} setSettings={setSettings} pages={pages} setPages={setPages} onNotify={onNotify} onPreview={openPreview}/>} 
    {section==="settings"&&<SiteSettings settings={settings} setSettings={setSettings} onNotify={onNotify} onPreview={openPreview}/>} 
    {section==="audit"&&<Audit onNotify={onNotify}/>} 
    {selected&&<UserModal data={selected} onClose={()=>setSelected(null)}/>} 
  </section>;

  return <div className={`admin ${previewOpen?"with-preview":""} ${sidebarCollapsed?"sidebar-collapsed":""} ${mobileNavOpen?"mobile-nav-open":""}`}>
    {mobileNavOpen&&<button className="admin-nav-backdrop" aria-label="Close admin menu" onClick={()=>setMobileNavOpen(false)}/>} 
    <aside className="admin-nav" aria-label="Admin navigation">
      <div className="admin-nav-head"><div className="admin-brand"><span className="admin-brand-mark">A</span><span className="admin-nav-label"><b>ATELIER</b><small>Control Room</small></span></div><button className="admin-nav-collapse" onClick={()=>setSidebarCollapsed(v=>!v)} aria-expanded={!sidebarCollapsed} aria-label={sidebarCollapsed?"Open full admin menu":"Collapse admin menu"} title={sidebarCollapsed?"Open menu":"Collapse menu"}><Icon name="chevron" size={15}/><span className="admin-nav-label">{sidebarCollapsed?"Open":"Collapse"}</span></button></div>
      <button className="admin-live-preview-toggle" onClick={()=>openPreview()} aria-pressed={previewOpen} title="Open or close storefront preview"><Icon name="grid" size={14}/><span className="admin-nav-label">{previewOpen?"Close Live Preview":"Live Preview"}</span></button>
      <div className="admin-nav-scroll">{tabs.map(([id,label,icon])=><button className={section===id?"active":""} key={id} onClick={()=>selectTab(id)} title={label} aria-label={label}><Icon name={icon} size={14}/><span className="admin-nav-label">{label}</span></button>)}</div>
      <div className="admin-nav-foot"><button onClick={()=>onNavigate("/")} title="View storefront"><span className="admin-nav-label">View storefront ↗</span><span className="admin-nav-icon-only">↗</span></button><button className="admin-logout" onClick={doLogout} title="Logout"><Icon name="close" size={14}/><span className="admin-nav-label">Logout</span></button></div>
    </aside>
    <button className="admin-mobile-nav-toggle" onClick={()=>setMobileNavOpen(v=>!v)} aria-expanded={mobileNavOpen} aria-controls="atelier-admin-navigation"><Icon name={mobileNavOpen?"close":"menu"} size={16}/><span>{mobileNavOpen?"Close menu":"Open menu"}</span></button>
    {main}
    {previewOpen&&<AdminLivePreview path={previewPath} onClose={()=>setPreviewOpen(false)}/>} 
  </div>
}
'''

s=s[:old_start]+new_admin+s[admin_end:]

# Replace Audit function with richer implementation
old_audit_start=s.index('function Audit(){')
audit_end=find_fn_end(s,old_audit_start)
new_audit=r'''function Audit({onNotify}:{onNotify:(x:string)=>void}){
  const [logs,setLogs]=useState<any[]>([]);
  const [busy,setBusy]=useState<string|"all"|null>(null);
  const load=async()=>{try{const v=await api<any[]>("/admin/audit");setLogs(Array.isArray(v)?v:[])}catch(e:any){onNotify(errorText(e.message))}};
  useEffect(()=>{void load()},[]);
  const deleteOne=async(id:string)=>{
    if(!confirm("Delete this audit event permanently? This cannot be undone."))return;
    setBusy(id);
    try{await api(`/admin/audit/${id}`,{method:"DELETE"});setLogs(v=>v.filter(x=>x.id!==id));onNotify("Audit event deleted.")}
    catch(e:any){onNotify(errorText(e.message))}finally{setBusy(null)}
  };
  const clearAll=async()=>{
    if(!logs.length)return;
    const confirmed=confirm(`Delete all ${logs.length} visible audit events permanently? This cannot be undone.`);
    if(!confirmed)return;
    const typed=prompt('Type DELETE AUDIT to confirm permanent removal:');
    if(typed!=="DELETE AUDIT")return onNotify("Audit deletion cancelled.");
    setBusy("all");
    try{await api("/admin/audit",{method:"DELETE"});setLogs([]);onNotify("Audit log cleared.")}
    catch(e:any){onNotify(errorText(e.message))}finally{setBusy(null)}
  };
  return <AdminPageFrame eyebrow="Traceability" title="Audit Log" description="Administrative activity and system traceability. Deletion is permanent and requires explicit confirmation." count={logs.length} actions={<div className="admin-toolbar-actions"><button className="btn text" onClick={()=>void load()} disabled={busy!==null}>Refresh</button><button className="btn danger" onClick={clearAll} disabled={!logs.length||busy!==null}><Icon name="trash" size={13}/> Delete all</button></div>}><div className="admin-audit-warning"><Icon name="shield" size={14}/><span>Audit deletion removes stored trace records and is not reversible.</span></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Details</th><th>Actions</th></tr></thead><tbody>{logs.length?logs.map(l=><tr key={l.id}><td>{new Date(l.createdAt).toLocaleString()}</td><td>{l.actor?.email||"System"}</td><td><span className="admin-badge">{l.action}</span></td><td>{l.entity}</td><td><details className="admin-details"><summary>View details</summary><pre>{JSON.stringify(l.details,null,2)}</pre></details></td><td><button className="btn text danger-text" onClick={()=>void deleteOne(l.id)} disabled={busy!==null}><Icon name="trash" size={13}/> Delete</button></td></tr>):<tr><td colSpan={6}><div className="admin-empty"><strong>No audit events.</strong><span>Administrative activity will appear here automatically.</span></div></td></tr>}</tbody></table></div></AdminPageFrame>
}
'''
s=s[:old_audit_start]+new_audit+s[audit_end:]
store.write_text(s)

# Backend add audit delete routes just before general admin pages getter.
b=backend.read_text()
needle='app.get("/api/admin/pages",requireAdmin,async(_req,res)=>res.json(await prisma.sitePage.findMany'
idx=b.index(needle)
insert=r'''app.delete("/api/admin/audit/:id",requireAdmin,async(req,res,next)=>{try{const id=routeParam(req,"id");const existing=await prisma.auditLog.findUnique({where:{id}});if(!existing)return res.status(404).json({error:"AUDIT_NOT_FOUND"});await prisma.auditLog.delete({where:{id}});res.json({ok:true,id});}catch(e){next(e)}});
app.delete("/api/admin/audit",requireAdmin,async(req,res,next)=>{try{const ids=z.array(z.string().min(1)).max(5000).optional().parse(req.body?.ids);if(ids?.length){const out=await prisma.auditLog.deleteMany({where:{id:{in:ids}}});return res.json({ok:true,deleted:out.count});}const out=await prisma.auditLog.deleteMany({});res.json({ok:true,deleted:out.count});}catch(e){next(e)}});
'''
b=b[:idx]+insert+b[idx:]
backend.write_text(b)

# CSS append admin controls and responsive behavior
c=css.read_text()
css_add=r'''
/* ===== ADMIN SHELL / SIDEBAR UX ===== */
.admin{position:relative;grid-template-columns:215px minmax(0,1fr)}
.admin.sidebar-collapsed{grid-template-columns:72px minmax(0,1fr)}
.admin.sidebar-collapsed.with-preview{grid-template-columns:72px minmax(0,1fr) minmax(420px,46vw)}
.admin-nav{min-width:0;display:flex!important;flex-direction:column;overflow:hidden}
.admin-nav-head{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:48px;margin-bottom:10px}
.admin-brand{display:flex;align-items:center;gap:10px;min-width:0}
.admin-brand-mark{display:grid;place-items:center;width:34px;height:34px;border:1px solid rgba(255,255,255,.25);font:500 15px/1 var(--serif);color:#f3ece3;flex:0 0 auto}
.admin-brand small,.admin-brand b{display:block;white-space:nowrap}
.admin-brand b{font-size:11px;letter-spacing:.18em}
.admin-brand small{margin-top:3px;color:#8f8178;font-size:8px;letter-spacing:.1em;text-transform:uppercase}
.admin-nav-collapse{width:auto!important;min-height:34px!important;padding:7px 8px!important;border:1px solid rgba(255,255,255,.18)!important;background:rgba(255,255,255,.03)!important;color:#b8a99f!important;justify-content:center!important;flex:0 0 auto}
.admin-nav-collapse:hover{background:rgba(255,255,255,.08)!important;color:#fff!important}
.admin-nav-collapse svg{transition:transform .18s ease}
.admin.sidebar-collapsed .admin-nav-collapse svg{transform:rotate(-90deg)}
.admin-nav-scroll{display:grid;gap:2px;overflow:auto;min-height:0;scrollbar-width:thin}
.admin-nav-scroll button{white-space:nowrap;min-width:0}
.admin-nav-foot{margin-top:auto}
.admin-nav-icon-only{display:none}
.admin.sidebar-collapsed .admin-nav-label{display:none}
.admin.sidebar-collapsed .admin-brand{justify-content:center;width:100%}
.admin.sidebar-collapsed .admin-nav-head{justify-content:center;flex-direction:column}
.admin.sidebar-collapsed .admin-nav-collapse{width:100%!important}
.admin.sidebar-collapsed .admin-nav button{justify-content:center;padding-inline:8px}
.admin.sidebar-collapsed .admin-nav-foot button{justify-content:center}
.admin.sidebar-collapsed .admin-nav-icon-only{display:inline}
.admin.sidebar-collapsed .admin-live-preview-toggle{justify-content:center!important}
.admin-nav-backdrop,.admin-mobile-nav-toggle{display:none}
.admin-audit-warning{display:flex;align-items:center;gap:8px;padding:11px 12px;margin:0 0 14px;border:1px solid #e3c4b8;background:#fbefe9;color:#714337;font-size:10px}
.admin-toolbar-actions .btn.danger,.admin-page .btn.danger{display:inline-flex;align-items:center;gap:6px;background:#8f3e31;border-color:#8f3e31;color:#fff}
.admin-toolbar-actions .btn.danger:hover,.admin-page .btn.danger:hover{background:#712f25;color:#fff}
.admin-page .admin-main .admin-table td:last-child .danger-text{display:inline-flex;align-items:center;gap:5px;color:#8f3e31}
@media(max-width:900px){
  .admin,.admin.sidebar-collapsed,.admin.with-preview,.admin.sidebar-collapsed.with-preview{grid-template-columns:1fr}
  .admin-nav{position:fixed!important;left:0;top:58px;bottom:0;width:min(300px,86vw);height:calc(100vh - 58px);z-index:30;transform:translateX(-102%);transition:transform .2s ease;box-shadow:18px 0 40px rgba(0,0,0,.18);border-right:1px solid #3c2c24;overflow:auto}
  .admin.mobile-nav-open .admin-nav{transform:translateX(0)}
  .admin.sidebar-collapsed .admin-nav{width:min(300px,86vw)}
  .admin.sidebar-collapsed .admin-nav-label{display:inline}
  .admin.sidebar-collapsed .admin-nav-head{flex-direction:row;justify-content:space-between}
  .admin.sidebar-collapsed .admin-nav button{justify-content:flex-start;padding-inline:12px}
  .admin.sidebar-collapsed .admin-nav-foot button{justify-content:flex-start}
  .admin.sidebar-collapsed .admin-live-preview-toggle{justify-content:flex-start!important}
  .admin-nav-icon-only{display:none!important}
  .admin-nav-backdrop{display:block;position:fixed;inset:58px 0 0;border:0;background:rgba(0,0,0,.35);z-index:20}
  .admin-mobile-nav-toggle{display:inline-flex;position:fixed;top:68px;left:14px;z-index:25;align-items:center;gap:7px;border:1px solid #3c2c24;background:#18110e;color:#f3ece3;padding:9px 11px;font-size:10px;letter-spacing:.08em;text-transform:uppercase;box-shadow:0 8px 18px rgba(0,0,0,.18)}
  .admin-main{padding-top:78px}
}
@media(max-width:640px){.admin-mobile-nav-toggle{top:66px;left:10px}.admin-main{padding-inline:14px}.admin-audit-warning{align-items:flex-start}.admin-table{font-size:10px}}
'''
if 'ADMIN SHELL / SIDEBAR UX' not in c:
    c += '\n'+css_add
css.write_text(c)

# Add a static admin function audit script.
audit_path=root/'tools/admin-function-audit.mjs'
aud=r'''import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const frontend=fs.readFileSync(path.join(root,"frontend/components/storefront/storefront.tsx"),"utf8");
const backend=fs.readFileSync(path.join(root,"backend/src/index.ts"),"utf8");
const results=[];
const check=(name,ok,detail)=>results.push({name,ok,detail});

const routeRe=/app\.(get|post|patch|put|delete)\(["'`]\/api([^"'`]+)["'`]/g;
const routes=[]; let m; while((m=routeRe.exec(backend))) routes.push(`${m[1].toUpperCase()} ${m[2]}`);
const required=[
  "GET /admin/stats","GET /admin/users","GET /admin/users/:id","PATCH /admin/users/:id","POST /admin/users/:id/block","POST /admin/users/:id/unblock","DELETE /admin/users/:id",
  "GET /admin/orders","GET /admin/payments","PATCH /admin/orders/:id",
  "GET /admin/products","POST /admin/products","PATCH /admin/products/:id","DELETE /admin/products/:id",
  "GET /admin/categories","POST /admin/categories","PATCH /admin/categories/:id","DELETE /admin/categories/:id",
  "GET /admin/settings","PUT /admin/settings",
  "GET /admin/audit","DELETE /admin/audit","DELETE /admin/audit/:id",
  "GET /admin/pages","POST /admin/pages","PATCH /admin/pages/:id","DELETE /admin/pages/:id","POST /admin/pages/:id/reset",
  "POST /admin/images/upload",
  "POST /admin/sections/:id/duplicate","PATCH /admin/sections/:id","DELETE /admin/sections/:id","POST /admin/pages/:id/sections"
];
for(const r of required) check(`Backend route: ${r}`,routes.includes(r),routes.includes(r)?"implemented":"missing");

const adminCalls=[...frontend.matchAll(/api(?:<[^>]+>)?\(`?\/?admin[^"'`)]*/g)].length;
check("Admin API calls present",adminCalls>0,`${adminCalls} frontend admin call sites detected`);
for(const section of ["dashboard","products","orders","payments","users","categories","builder","settings","audit"])
  check(`Admin section wired: ${section}`,frontend.includes(`section===\"${section}\"`),frontend.includes(`section===\"${section}\"`)?"wired":"missing");

check("Sidebar collapse/expand control",frontend.includes("sidebarCollapsed")&&frontend.includes("Collapse")&&frontend.includes("Open"),"state + accessible toggle present");
check("Mobile admin menu open/close",frontend.includes("mobileNavOpen")&&frontend.includes("Open menu")&&frontend.includes("Close menu"),"off-canvas controls present");
check("Live preview open/close",frontend.includes("previewOpen")&&frontend.includes("Close Live Preview"),"preview control present");
check("Audit single delete",frontend.includes('/admin/audit/${id}')&&frontend.includes('method:"DELETE"'),"per-event delete wired");
check("Audit bulk delete",frontend.includes('/admin/audit",{method:"DELETE"')&&frontend.includes("DELETE AUDIT"),"bulk delete + typed confirmation wired");

// Verify admin mutations are protected by requireAdmin on route declarations nearby.
for(const action of [
  'app.delete("/api/admin/audit/:id",requireAdmin', 'app.delete("/api/admin/audit",requireAdmin',
  'app.patch("/api/admin/products/:id",requireAdmin', 'app.put("/api/admin/settings",requireAdmin',
  'app.patch("/api/admin/orders/:id",requireAdmin', 'app.delete("/api/admin/users/:id",requireAdmin'
]) check(`Admin authorization: ${action.slice(4, action.indexOf(',requireAdmin'))}`,backend.includes(action),"requireAdmin enforced");

const failed=results.filter(r=>!r.ok);
for(const r of results) console.log(`${r.ok?"PASS":"FAIL"}\t${r.name}\t${r.detail}`);
console.log(`ADMIN_FUNCTION_AUDIT ${results.length-failed.length}/${results.length} PASS`);
if(failed.length) process.exit(1);
'''
aud.replace('"POST /admin/sections/:id/duplicate"','"POST /admin/sections/:id/duplicate"')
audit_path.write_text(aud)

# Add script entry
pkg=root/'package.json'; pj=pkg.read_text();
if '"qa:admin-functions"' not in pj:
    pj=pj.replace('"qa:live-preview": "node tools/live-preview-audit.mjs"','"qa:live-preview": "node tools/live-preview-audit.mjs",\n    "qa:admin-functions": "node tools/admin-function-audit.mjs"')
pkg.write_text(pj)

print('patched')
