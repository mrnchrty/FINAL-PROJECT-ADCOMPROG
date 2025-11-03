
const API = '/api'
let currentEditId = null
const $ = s => document.querySelector(s)
const $$ = s => Array.from(document.querySelectorAll(s))

// Sidebar responsive: clicking the left panel toggles it on small screens
const sidebar = document.getElementById('sidebar')
sidebar.addEventListener('click', (e) => {
  // if small screen, toggle hidden
  if(window.innerWidth < 900){
    sidebar.classList.toggle('hidden')
  }
})

// Attach active highlighting is server-rendered via Jinja; no extra work needed here

// Search behavior: present only on pages where show_search is true (rendered server-side)
const searchBtn = $('#search-btn')
if(searchBtn){
  searchBtn.addEventListener('click', ()=>{
    const q = $('#search-input').value.trim()
    // redirect to inventory with query param to allow server-side handling
    window.location.href = '/inventory?q=' + encodeURIComponent(q)
  })
}

// Load inventory list on inventory page
if($('#inventory-table')){
  loadInventoryFromAPI()
}

// Similarly for low and expiring pages
if($('#low-table')) loadLowFromAPI()
if($('#expiring-table')) loadExpiringFromAPI()

// Dashboard charts (only on dashboard page)
if(document.getElementById('mostUsedChart')){
  loadDashboardCharts()
}

async function loadInventoryFromAPI(q=''){
  const url = q ? `${API}/items?q=${encodeURIComponent(q)}` : `${API}/items`
  const res = await fetch(url); const items = await res.json()
  const tbody = document.querySelector('#inventory-table tbody'); tbody.innerHTML = ''
  items.forEach(it=>{
    const tr = document.createElement('tr')
    tr.innerHTML = `<td>${it.id}</td><td>${it.name}</td><td>${it.stock}</td><td>${it.dom||''}</td><td>${it.doe||''}</td><td>${it.barcode||''}</td><td><button class="edit-btn" data-id="${it.id}">✎</button></td>`
    tbody.appendChild(tr)
  })
  attachInventoryButtons()
  // update totals if present (dashboard may show totals)
  const total = items.reduce((s,i)=>s+(i.stock||0),0)
  const totalEl = document.getElementById('total-supply'); if(totalEl) totalEl.textContent = total
}

async function loadLowFromAPI(){
  const res = await fetch(`${API}/items?tab=low`); const items = await res.json()
  const tbody = document.querySelector('#low-table tbody'); tbody.innerHTML = ''
  items.forEach(it=>{
    const tr = document.createElement('tr')
    tr.innerHTML = `<td>${it.id}</td><td>${it.name}</td><td class="highlight-stock">${it.stock}</td><td>${it.low_stock_threshold||0}</td><td><button class="edit-btn" data-id="${it.id}">✎</button></td>`
    tbody.appendChild(tr)
  })
  const lowCountEl = document.getElementById('low-stock-count'); if(lowCountEl) lowCountEl.textContent = items.length
  attachInventoryButtons()
}

async function loadExpiringFromAPI(){
  const res = await fetch(`${API}/items?tab=expiring`); const items = await res.json()
  const now = new Date(); let count=0
  const tbody = document.querySelector('#expiring-table tbody'); tbody.innerHTML = ''
  items.forEach(it=>{
    if(!it.expires_on) return
    const ex = new Date(it.expires_on)
    const daysLeft = Math.ceil((ex - now)/(1000*60*60*24))
    if(ex.getMonth()===now.getMonth() && ex.getFullYear()===now.getFullYear()) count++
    const expClass = daysLeft <= 7 ? 'highlight-expire' : ''
    const tr = document.createElement('tr')
    tr.innerHTML = `<td>${it.id}</td><td>${it.name}</td><td class="${expClass}">${it.expires_on}</td><td>${daysLeft}</td><td><button class="edit-btn" data-id="${it.id}">✎</button></td>`
    tbody.appendChild(tr)
  })
  const expCountEl = document.getElementById('expiring-count'); if(expCountEl) expCountEl.textContent = count
  attachInventoryButtons()
}

function attachInventoryButtons(){
  $$('.edit-btn').forEach(b=> b.onclick = async (e)=>{
    const id = e.currentTarget.dataset.id; currentEditId = id
    // open modal if exists on page
    const modal = document.getElementById('item-modal'); if(!modal) return
    const res = await fetch(`${API}/items/${id}`); const it = await res.json()
    document.getElementById('modal-title').textContent = 'Edit Item'
    document.getElementById('item-name').value = it.name || ''
    document.getElementById('item-barcode').value = it.barcode || ''
    document.getElementById('item-stock').value = it.stock || 0
    document.getElementById('item-dom').value = it.dom || ''
    document.getElementById('item-doe').value = it.doe || ''
    document.getElementById('item-threshold').value = it.low_stock_threshold || 5
    document.getElementById('item-expires').value = it.expires_on || ''
    modal.classList.remove('hidden')
  })
}

// add item modal behavior (only if modal present)
if(document.getElementById('add-item-btn')){
  document.getElementById('add-item-btn').addEventListener('click', ()=>{
    currentEditId = null
    const modal = document.getElementById('item-modal'); if(!modal) return
    document.getElementById('modal-title').textContent = 'Add Item'
    document.getElementById('item-name').value=''; document.getElementById('item-barcode').value=''; document.getElementById('item-stock').value=0
    document.getElementById('item-dom').value=''; document.getElementById('item-doe').value=''; document.getElementById('item-threshold').value=5; document.getElementById('item-expires').value=''
    modal.classList.remove('hidden')
  })
}

if(document.getElementById('cancel-item')){
  document.getElementById('cancel-item').addEventListener('click', ()=> document.getElementById('item-modal').classList.add('hidden'))
}
if(document.getElementById('save-item')){
  document.getElementById('save-item').addEventListener('click', async ()=>{
    const payload = {
      name: document.getElementById('item-name').value,
      barcode: document.getElementById('item-barcode').value,
      stock: parseInt(document.getElementById('item-stock').value||0),
      dom: document.getElementById('item-dom').value || null,
      doe: document.getElementById('item-doe').value || null,
      low_stock_threshold: parseInt(document.getElementById('item-threshold').value||5),
      expires_on: document.getElementById('item-expires').value || null
    }
    if(currentEditId){
      await fetch(`${API}/items/${currentEditId}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)})
    } else {
      await fetch(`${API}/items`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)})
    }
    // refresh page's data
    if(document.getElementById('inventory-table')) loadInventoryFromAPI()
    if(document.getElementById('low-table')) loadLowFromAPI()
    if(document.getElementById('expiring-table')) loadExpiringFromAPI()
    document.getElementById('item-modal').classList.add('hidden')
  })
}

// charts for dashboard
async function loadDashboardCharts(){
  const res = await fetch(`${API}/items`); const items = await res.json()
  const sorted = items.slice().sort((a,b)=>(b.times_used||0)-(a.times_used||0)).slice(0,6)
  const ctx = document.getElementById('mostUsedChart').getContext('2d')
  new Chart(ctx, {type:'bar', data:{labels: sorted.map(x=>x.name), datasets:[{label:'Times Used', data: sorted.map(x=>x.times_used||0), backgroundColor:'rgba(183,28,28,0.9)'}]}, options:{responsive:true, maintainAspectRatio:false, scales:{y:{beginAtZero:true}}}})

  const now = new Date()
  const exThis = items.filter(it=>it.expires_on).filter(it=>{ const d=new Date(it.expires_on); return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear() })
  const ctx2 = document.getElementById('expiringChart').getContext('2d')
  new Chart(ctx2, {type:'line', data:{labels: exThis.map(x=>x.name), datasets:[{label:'Days Left', data: exThis.map(x=> Math.ceil((new Date(x.expires_on)-now)/(1000*60*60*24)) ), borderColor:'rgba(183,28,28,0.9)', fill:false}]}, options:{responsive:true, maintainAspectRatio:false, scales:{y:{beginAtZero:true}}}})
}
