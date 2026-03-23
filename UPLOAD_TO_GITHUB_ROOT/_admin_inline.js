
// -- NAV --
document.querySelectorAll('.nav-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('on'));
    document.querySelectorAll('.pg').forEach(p=>p.classList.remove('on'));
    btn.classList.add('on');
    document.getElementById('pg-'+btn.dataset.pg).classList.add('on');
    document.getElementById('tit').firstChild.nodeValue=btn.dataset.t+' ';
    document.getElementById('crumb').textContent='/ '+btn.dataset.c;
    document.getElementById('cv').scrollTop=0;
    const pg=btn.dataset.pg;
    if(pg==='dashboard'){setTimeout(function(){if(window.Chart&&window.LC===null)buildLine(D7);},80);}
    if(pg==='activity'&&!window._A){window._A=1;setTimeout(buildActChart,50)}
    if(pg==='map'&&!window._M){window._M=1;setTimeout(initMap,200)}
    if(pg==='map'&&!window._M){window._M=1;setTimeout(initMap,100)}
    if(pg==='ai'&&!window._AI){window._AI=1;setTimeout(buildAiCharts,50)}
    if(pg==='analytics'&&!window._AN){window._AN=1;setTimeout(buildAnalytics,50)}
  });
});

// -- CHART COMMON --
const F={family:"'DM Sans',sans-serif"};
Chart.defaults.font=F;
Chart.defaults.color='rgba(244,244,246,0.38)';
const TT={backgroundColor:'#1E1E24',borderColor:'rgba(255,255,255,0.07)',borderWidth:1,titleColor:'#F4F4F6',bodyColor:'rgba(244,244,246,0.55)',padding:10,cornerRadius:7,titleFont:{...F,weight:'600',size:12},bodyFont:{...F,size:11.5}};
const GR={color:'rgba(255,255,255,0.05)',drawBorder:false};
const TK={font:{...F,size:11},color:'rgba(244,244,246,0.3)'};

// -- LINE CHART --
const D7={L:['Sep','Oct','Nov','Dec','Jan','Feb','Mar'],u:[8400,10200,11800,13500,16000,19400,24318],c:[3100,4200,5500,6800,8200,10100,12047]};
const D12={L:['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'],u:[3100,4200,5100,5900,6800,8400,10200,11800,13500,16000,19400,24318],c:[800,1200,1700,2100,2600,3100,4200,5500,6800,8200,10100,12047]};
var LC=null;
function buildLine(d){
  if(LC){LC.destroy();LC=null;}
  var canvasEl=document.getElementById('lineChart');
  if(!canvasEl)return;
  var parent=canvasEl.parentNode;
  var w=Math.floor(parent.clientWidth||parent.offsetWidth||500);
  var h=160;
  canvasEl.width=w; canvasEl.height=h;
  LC=new Chart(canvasEl,{
    type:'line',
    data:{labels:d.L,datasets:[
      {label:'Users',data:d.u,borderColor:'#C9A84C',backgroundColor:'rgba(201,168,76,0.1)',
       tension:0.4,fill:true,pointRadius:3,pointHoverRadius:5,pointBackgroundColor:'#C9A84C',borderWidth:2},
      {label:'Capsules',data:d.c,borderColor:'#1FC99A',backgroundColor:'rgba(31,201,154,0.07)',
       tension:0.4,fill:true,pointRadius:3,pointHoverRadius:5,pointBackgroundColor:'#1FC99A',borderWidth:2}
    ]},
    options:{
      responsive:false,animation:false,
      interaction:{mode:'index',intersect:false},
      layout:{padding:{top:8,right:8,bottom:0,left:0}},
      plugins:{
        legend:{position:'top',align:'end',labels:{color:'rgba(244,244,246,0.55)',
          font:{family:"'DM Sans',sans-serif",size:11},boxWidth:7,boxHeight:7,
          usePointStyle:true,pointStyle:'circle',padding:16}},
        tooltip:{backgroundColor:'#1E1E24',borderColor:'rgba(255,255,255,0.1)',
          borderWidth:1,titleColor:'#fff',bodyColor:'rgba(244,244,246,0.6)',
          padding:10,cornerRadius:6,displayColors:true,boxWidth:8,boxHeight:8,
          titleFont:{family:"'DM Sans',sans-serif",weight:'600',size:12},
          bodyFont:{family:"'DM Sans',sans-serif",size:11}}
      },
      scales:{
        x:{grid:{display:false},border:{display:false},
           ticks:{color:'rgba(244,244,246,0.3)',font:{family:"'DM Sans',sans-serif",size:10},
             maxRotation:0,maxTicksLimit:7}},
        y:{grid:{color:'rgba(255,255,255,0.04)',drawBorder:false},
           border:{display:false,dash:[3,3]},
           position:'left',
           ticks:{color:'rgba(244,244,246,0.3)',font:{family:"'DM Sans',sans-serif",size:10},
             maxTicksLimit:5,padding:4,callback:function(v){return v>=1000?(v/1000).toFixed(0)+'k':v;}},
           beginAtZero:false}
      }
    }
  });
}
function buildDonut(id,data,labels,colors){
  new Chart(document.getElementById(id),{type:'doughnut',data:{labels,datasets:[{data,backgroundColor:colors,borderWidth:0,hoverOffset:4}]},
    options:{responsive:false,cutout:'70%',plugins:{legend:{display:false},tooltip:{...TT,callbacks:{label:c=>' '+c.label+': '+c.parsed+'%'}}}}});
}

// -- INIT ON LOAD --
window.addEventListener('load',function(){
  function tryChart(n){
    if(window.Chart){buildLine(D7);buildDonut('donutChart',[48,27,15,10],['Text','Photo','Voice','Secret'],['#C9A84C','#4F87F5','#1FC99A','#9270EF']);}
    else if(n>0){setTimeout(function(){tryChart(n-1);},200);}
  }
  setTimeout(function(){tryChart(10);},300);
  document.getElementById('lineSelect').addEventListener('change',e=>buildLine(e.value==='12'?D12:D7));

});

// -- ACTIVITY CHART --
function buildActChart(){
  new Chart(document.getElementById('actChart'),{type:'bar',
    data:{labels:['00','02','04','06','08','10','12','14','16','18','20','22'],datasets:[{data:[12,8,5,4,18,42,68,75,61,48,38,25],backgroundColor:'rgba(79,135,245,0.45)',borderColor:'#4F87F5',borderWidth:1.5,borderRadius:4,borderSkipped:false}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:TT},scales:{x:{grid:{display:false},ticks:TK},y:{grid:GR,ticks:TK}}}});
}

// -- AI CHARTS --
function buildAiCharts(){
  const hrs=['00','02','04','06','08','10','12','14','16','18','20','22'];
  function mini(id,data,color){
    new Chart(document.getElementById(id),{type:'line',
      data:{labels:hrs,datasets:[{data,borderColor:color,backgroundColor:color.replace('rgb(','rgba(').replace(')',',0.08)'),tension:0.4,fill:true,pointRadius:0,borderWidth:1.6}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{enabled:false}},scales:{x:{display:false},y:{display:false}}}});
  }
  mini('aiReqChart',[120,85,60,40,180,340,520,610,490,380,290,200],'rgb(201,168,76)');
  mini('aiLatChart',[0.7,0.6,0.6,0.55,0.8,1.1,1.3,1.34,1.2,1.0,0.9,0.85],'rgb(224,160,48)');
  new Chart(document.getElementById('aiTokChart'),{type:'bar',
    data:{labels:['Mar 8','9','10','11','12','13','Mar 14'],datasets:[{label:'Tokens',data:[68,82,74,90,103,88,110],backgroundColor:'rgba(79,135,245,0.4)',borderColor:'#4F87F5',borderWidth:1.5,borderRadius:4,borderSkipped:false}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:TT},scales:{x:{grid:{display:false},ticks:TK},y:{grid:GR,ticks:TK}}}});
}
// -- ANALYTICS CHARTS --
function buildAnalytics(){
  new Chart(document.getElementById('anBarChart'),{type:'bar',
    data:{labels:['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'],
      datasets:[
        {label:'Registrations',data:[420,580,690,750,820,980,1240,1380,1520,1840,2100,2580],backgroundColor:'rgba(201,168,76,0.5)',borderColor:'#C9A84C',borderWidth:1.5,borderRadius:4,borderSkipped:false},
        {label:'Capsules',data:[180,260,320,390,440,530,680,760,890,1020,1180,1420],backgroundColor:'rgba(31,201,154,0.35)',borderColor:'#1FC99A',borderWidth:1.5,borderRadius:4,borderSkipped:false}
      ]},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{labels:{color:'rgba(244,244,246,0.55)',font:F,boxWidth:8,boxHeight:8,usePointStyle:true,pointStyle:'circle',padding:16}},tooltip:TT},
      scales:{x:{grid:{display:false},ticks:TK},y:{grid:GR,ticks:TK}}}});
  buildDonut('trafDonut',[38,29,22,11],['Direct','Social','Search','Referral'],['#4F87F5','#1FC99A','#C9A84C','#9270EF']);
}

// -- SIDEBAR TOGGLE --
var sbAside=document.querySelector('.sb');
var sbToggleBtn=document.getElementById('sbToggle');
if(sbAside&&sbToggleBtn){
  sbToggleBtn.addEventListener('click',function(){
    sbAside.classList.toggle('coll');
  });
}

// -- DROPDOWNS --
function togglePanel(panelId){
  var p=document.getElementById(panelId);
  if(!p)return;
  var isOpen=p.style.display==='block';
  // close all panels first
  ['notifPanel','profilePanel'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.style.display='none';
  });
  if(!isOpen)p.style.display='block';
}
document.addEventListener('click',function(e){
  var notifWrap=document.getElementById('notifWrap');
  var profWrap=document.getElementById('profileWrap');
  if(notifWrap&&!notifWrap.contains(e.target)){var p=document.getElementById('notifPanel');if(p)p.style.display='none';}
  if(profWrap&&!profWrap.contains(e.target)){var p=document.getElementById('profilePanel');if(p)p.style.display='none';}
});
var _nb=document.getElementById('notifBtn');
if(_nb)_nb.addEventListener('click',function(e){e.stopPropagation();togglePanel('notifPanel');});
var _pb=document.getElementById('profileTopBtn');
if(_pb)_pb.addEventListener('click',function(e){e.stopPropagation();togglePanel('profilePanel');});

// -- CLEAR NOTIFICATIONS --
var _cn=document.getElementById('clearNotif');
if(_cn){
  _cn.addEventListener('click',function(){
    var items=document.querySelectorAll('.notif-item');
    items.forEach(function(item,i){
      setTimeout(function(){
        item.style.transition='opacity 0.3s,transform 0.3s';
        item.style.opacity='0';
        item.style.transform='translateX(10px)';
      },i*60);
    });
    var dot=document.getElementById('notifDot');
    if(dot){dot.style.transition='opacity 0.3s';dot.style.opacity='0';}
    setTimeout(function(){
      var p=document.getElementById('notifPanel');
      if(p)p.style.display='none';
      var list=document.querySelector('.notif-list');
      if(list)list.innerHTML='<div style="padding:32px 16px;text-align:center;color:var(--g2);font-size:12.5px">___ _____ ___________</div>';
      if(dot)dot.style.display='none';
    },items.length*60+350);
  });
}

// -- OPEN PROFILE FROM DROPDOWN --
var _opfd=document.getElementById('openProfileFromDrop');
if(_opfd){_opfd.addEventListener('click',function(){
  var p=document.getElementById('profilePanel');if(p)p.style.display='none';
  openModal();
});}

// -- PROFILE MODAL --
var profileModal=document.getElementById('profileModal');
function openModal(){if(profileModal)profileModal.classList.add('open');}
function closeModal(){if(profileModal)profileModal.classList.remove('open');}
var _op=document.getElementById('openProfile');if(_op)_op.addEventListener('click',openModal);
var _cp=document.getElementById('closeProfile');if(_cp)_cp.addEventListener('click',closeModal);
var _ca=document.getElementById('cancelProfile');if(_ca)_ca.addEventListener('click',closeModal);
if(profileModal)profileModal.addEventListener('click',function(e){if(e.target===profileModal)closeModal();});
var _sp=document.getElementById('saveProfile');
if(_sp){_sp.addEventListener('click',function(){
  var fn=(document.getElementById('pFirstName')||{value:'Admin'}).value.trim();
  var ln=(document.getElementById('pLastName')||{value:'Odyla'}).value.trim();
  var un=document.querySelector('.u-name');if(un)un.textContent=fn+' '+ln;
  closeModal();
});}
var _ai=document.getElementById('avatarInput');
if(_ai){_ai.addEventListener('change',function(){
  if(!this.files||!this.files[0])return;
  var r=new FileReader();
  r.onload=function(e){
    var s=e.target.result;
    // Profile modal avatar
    var pi=document.getElementById('profileAvaImg');
    if(pi){pi.src=s;pi.style.display='block';}
    var pa=document.getElementById('profileAva');
    if(pa){var t=pa.childNodes[0];if(t&&t.nodeType===3)t.nodeValue='';}
    // Sidebar avatar (bottom)
    var si=document.getElementById('sidebarAvaImg');
    if(si){si.src=s;si.style.display='block';}
    var sa=document.getElementById('sidebarAva');
    if(sa){var t=sa.childNodes[0];if(t&&t.nodeType===3)t.nodeValue='';}
    // Topbar avatar circle
    var tb=document.getElementById('profileTopBtn');
    if(tb){
      var img=document.getElementById('topAvaImg');
      if(!img){img=document.createElement('img');img.id='topAvaImg';img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%';tb.style.position='relative';tb.appendChild(img);}
      img.src=s;img.style.display='block';
      var txt=tb.childNodes[0];if(txt&&txt.nodeType===3)txt.nodeValue='';
    }
    // Dropdown avatar
    var da=document.getElementById('dropAva');
    if(da){da.style.background='none';da.style.padding='0';da.style.overflow='hidden';
      var dimg=da.querySelector('img')||document.createElement('img');
      dimg.src=s;dimg.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:50%;display:block';
      if(!da.querySelector('img'))da.appendChild(dimg);
      var dtxt=da.childNodes[0];if(dtxt&&dtxt.nodeType===3)dtxt.nodeValue='';
    }
  };r.readAsDataURL(this.files[0]);
});}

// -- MAP --
function initMap(){
  if(!window.L||!document.getElementById('worldMap'))return;
  var map=L.map('worldMap',{zoomControl:true,scrollWheelZoom:false,attributionControl:false}).setView([30,20],2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18}).addTo(map);
  var pts=[
    {lat:55.75,lng:37.62,city:'Moscow',count:4210,col:'#C9A84C'},
    {lat:59.93,lng:30.32,city:'St.Pete',count:2140,col:'#C9A84C'},
    {lat:41.30,lng:69.24,city:'Tashkent',count:3800,col:'#1FC99A'},
    {lat:43.24,lng:76.89,city:'Almaty',count:1620,col:'#9270EF'},
    {lat:50.45,lng:30.52,city:'Kyiv',count:980,col:'#4F87F5'},
    {lat:53.90,lng:27.57,city:'Minsk',count:740,col:'#4F87F5'},
    {lat:51.18,lng:71.45,city:'Astana',count:620,col:'#9270EF'},
    {lat:48.86,lng:2.35,city:'Paris',count:290,col:'#4F87F5'},
    {lat:51.51,lng:-0.13,city:'London',count:260,col:'#4F87F5'},
    {lat:52.52,lng:13.40,city:'Berlin',count:240,col:'#4F87F5'},
    {lat:40.71,lng:-74.01,city:'New York',count:180,col:'#967EF0'},
    {lat:35.68,lng:139.69,city:'Tokyo',count:120,col:'#1FC99A'}
  ];
  pts.forEach(function(p){
    var r=Math.max(7,Math.min(22,Math.round(Math.log(p.count/50+1)*5)));
    var c=L.circleMarker([p.lat,p.lng],{radius:r,color:p.col,fillColor:p.col,fillOpacity:0.75,weight:2}).addTo(map);
    c.bindPopup('<div style="background:#1E1E24;border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:10px 13px;color:#F4F4F6;font-family:DM Sans,sans-serif"><b style="font-size:13px">'+p.city+'</b><br><span style="font-size:11px;color:rgba(244,244,246,0.5)">Capsules: <b style="color:'+p.col+'">'+p.count+'</b></span></div>');
  });
}


window.addEventListener('resize',function(){if(LC)LC.resize();});


function doExport(){
  var sel=document.getElementById('lineSelect');
  var d=sel&&sel.value==='12'?D12:D7;
  var rows=['Month,Users,Capsules'];
  d.L.forEach(function(l,i){rows.push(l+','+d.u[i]+','+d.c[i]);});
  var csv=rows.join('\n');
  var blob=new Blob([csv],{type:'text/csv'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;a.download='users-growth.csv';a.click();
  URL.revokeObjectURL(url);
}
// -- EXPORT CSV --
document.querySelectorAll('.btn, .btn-s').forEach(function(btn){
  var t=btn.textContent.trim();if(t.indexOf('____')>-1||t.indexOf('xport')>-1||t==='_______'){btn.style.cursor='pointer';
    btn.addEventListener('click',function(){
      var csv='Month,Users,Capsules\nSep,8400,3100\nOct,10200,4200\nNov,11800,5500\nDec,13500,6800\nJan,16000,8200\nFeb,19400,10100\nMar,24318,12047\n';
      var blob=new Blob([csv],{type:'text/csv'});
      var url=URL.createObjectURL(blob);
      var a=document.createElement('a');a.href=url;a.download='export.csv';a.click();URL.revokeObjectURL(url);
    });
  }
});


