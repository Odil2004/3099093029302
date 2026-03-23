

// -- NAV --

document.querySelectorAll('.nav-btn').forEach(btn=>{

  btn.addEventListener('click',()=>{

    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('on'));

    document.querySelectorAll('.pg').forEach(p=>p.classList.remove('on'));

    btn.classList.add('on');

    var pgEl=document.getElementById('pg-'+btn.dataset.pg);
    if(pgEl){pgEl.classList.add('on');}

    var title=document.getElementById('tit');
    if(title&&title.firstChild)title.firstChild.nodeValue=btn.dataset.t+' ';
    var crumb=document.getElementById('crumb');
    if(crumb)crumb.textContent='/ '+btn.dataset.c;

    var cv=document.getElementById('cv');
    if(cv)cv.scrollTop=0;

    const pg=btn.dataset.pg;

    if(pg==='dashboard'){
      setTimeout(function(){
        if(window.DASH_DATA){scheduleDashboardCharts();}
      },80);
    }

    if(pg==='activity'){setTimeout(function(){buildActChart((window.DASH_DATA&&window.DASH_DATA.activityByHour)||[]);},80)}

    if(pg==='map'&&!window._M){window._M=1;setTimeout(initMap,120)}

    if(pg==='ai'){
      setTimeout(function(){
        buildAiCharts(window.DASH_DATA&&window.DASH_DATA.ai);
        renderAiLog(window.DASH_DATA&&window.DASH_DATA.ai&&window.DASH_DATA.ai.logs||[]);
        applyAiSummary(window.DASH_DATA&&window.DASH_DATA.ai||{});
      },80);
    }

    if(pg==='analytics'){setTimeout(function(){scheduleAnalyticsCharts();},80)}

    if(window.DASH_DATA){
      if(pg==='users')renderUsers(window.DASH_DATA.usersList||[]);
      if(pg==='capsules')renderCapsules(window.DASH_DATA.capsulesList||[]);
      if(pg==='reviews'){renderReviews(window.DASH_DATA.reviews||{});renderReviewSummary(window.DASH_DATA.reviews||{});}
      if(pg==='promos')renderPromoList(window.DASH_DATA.promoCodes||[]);
      if(pg==='activity'){renderActivity(window.DASH_DATA.activity||[],'activityFeedAll',20);}
      repairMojibakeInDom(document.getElementById('pg-'+pg));
    }

  });

});



// -- CHART COMMON --

const F={family:"'DM Sans',sans-serif"};

if(window.Chart){
  Chart.defaults.font=F;
  Chart.defaults.color='rgba(244,244,246,0.38)';
}

const TT={backgroundColor:'#1E1E24',borderColor:'rgba(255,255,255,0.07)',borderWidth:1,titleColor:'#F4F4F6',bodyColor:'rgba(244,244,246,0.55)',padding:10,cornerRadius:7,titleFont:{...F,weight:'600',size:12},bodyFont:{...F,size:11.5}};

const GR={color:'rgba(255,255,255,0.05)',drawBorder:false};

const TK={font:{...F,size:11},color:'rgba(244,244,246,0.3)'};

function destroyChartFor(elOrId){
  if(!window.Chart)return;
  var el=typeof elOrId==='string'?document.getElementById(elOrId):elOrId;
  if(!el)return;
  try{
    var existing=Chart.getChart(el);
    if(existing)existing.destroy();
  }catch(e){}
}

function ensureCanvasSize(el,fallbackHeight){
  if(!el)return {w:0,h:0};
  var parent=el.parentNode;
  var w=(parent&&parent.clientWidth)||el.clientWidth||0;
  var h=(parent&&parent.clientHeight)||el.clientHeight||0;
  if(!w||w<10){
    w=(parent&&parent.offsetWidth)||el.offsetWidth||500;
  }
  if(!h||h<10){
    h=fallbackHeight||160;
  }
  w=Math.max(10,Math.floor(w));
  h=Math.max(10,Math.floor(h));
  if(el.width!==w)el.width=w;
  if(el.height!==h)el.height=h;
  return {w:w,h:h};
}



// -- LINE CHART --

let D7={L:[],u:[],c:[]};
let D12={L:[],u:[],c:[]};
let D7D={L:[],u:[],c:[]};

var LC=null;

function buildLine(d){
  if(!window.Chart){
    ensureChart().then(function(){buildLine(d);});
    return;
  }

  if(LC){LC.destroy();LC=null;}

  var canvasEl=document.getElementById('lineChart');

  if(!canvasEl)return;
  destroyChartFor(canvasEl);

  var parent=canvasEl.parentNode;

  var w=Math.floor(parent.clientWidth||parent.offsetWidth||500);
  if(w<10){
    setTimeout(function(){buildLine(d);},120);
    return;
  }

  var h=160;

  canvasEl.width=w; canvasEl.height=h;

  const maxVal=Math.max.apply(null,(d.u||[]).concat(d.c||[],[0]));
  const yScale={
    grid:{color:'rgba(255,255,255,0.04)',drawBorder:false},
    border:{display:false,dash:[3,3]},
    position:'left',
    ticks:{color:'rgba(244,244,246,0.3)',font:{family:"'DM Sans',sans-serif",size:10},
      maxTicksLimit:5,padding:4,callback:function(v){return v>=1000?(v/1000).toFixed(0)+'k':v;}},
    beginAtZero:true
  };
  if(maxVal>1){delete yScale.beginAtZero;}
  if(maxVal<=1){yScale.suggestedMax=1;}

  LC=new Chart(canvasEl,{

    type:'line',

    data:{labels:d.L,datasets:[

      {label:'Users',data:d.u,borderColor:'#C9A84C',backgroundColor:'rgba(201,168,76,0.1)',

       tension:0.4,fill:true,pointRadius:3,pointHoverRadius:5,pointBackgroundColor:'#C9A84C',borderWidth:2},

      {label:'\u041a\u0430\u043f\u0441\u0443\u043b\u044b',data:d.c,borderColor:'#1FC99A',backgroundColor:'rgba(31,201,154,0.07)',

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

        y:yScale

      }

    }

  });

}

function buildDonut(id,data,labels,colors){
  if(!window.Chart){
    ensureChart().then(function(){buildDonut(id,data,labels,colors);});
    return;
  }
  var el=document.getElementById(id);
  if(!el)return;
  destroyChartFor(el);
  ensureCanvasSize(el,144);
  new Chart(el,{type:'doughnut',data:{labels,datasets:[{data,backgroundColor:colors,borderWidth:0,hoverOffset:4}]},
    options:{responsive:false,maintainAspectRatio:false,cutout:'70%',plugins:{legend:{display:false},tooltip:{...TT,callbacks:{label:c=>' '+c.label+': '+c.parsed+'%'}}}}});

}



// -- INIT ON LOAD --

function bootAdmin(){
  loadDashboard();
  applyStoredProfile();
  applyStoredSettings();

  var ls=document.getElementById('lineSelect');
  if(ls){
    ls.addEventListener('change',function(e){
      var v=e&&e.target&&e.target.value;
      if(v==='12') buildLine(D12);
      else if(v==='7d') buildLine(D7D);
      else buildLine(D7);
    });
  }

  var pm=document.getElementById('promoMonthBtn');
  if(pm)pm.addEventListener('click',function(){generatePromoAdmin('month');});
  var py=document.getElementById('promoYearBtn');
  if(py)py.addEventListener('click',function(){generatePromoAdmin('year');});
  var pd=document.getElementById('promoDisableBtn');
  if(pd)pd.addEventListener('click',function(){disablePromoAdmin();});
  var po=document.getElementById('promoOutMeta');
  if(po)po.addEventListener('click',function(){copyPromoOut();});

  var aiRefresh=document.getElementById('aiRefreshBtn');
  if(aiRefresh)aiRefresh.addEventListener('click',function(){loadDashboard();});
  var aiExport=document.getElementById('aiExportBtn');
  if(aiExport)aiExport.addEventListener('click',function(){exportAiLogs();});

  var dashAllUsers=document.getElementById('dashAllUsersBtn');
  if(dashAllUsers)dashAllUsers.addEventListener('click',function(){goToPage('users');});
  var qaNew=document.getElementById('qaNewUser');
  if(qaNew)qaNew.addEventListener('click',function(){goToPage('users');});
  var qaCap=document.getElementById('qaCapsule');
  if(qaCap)qaCap.addEventListener('click',function(){goToPage('capsules');});
  var qaAnal=document.getElementById('qaAnalytics');
  if(qaAnal)qaAnal.addEventListener('click',function(){goToPage('analytics');});
  var qaExp=document.getElementById('qaExport');
  if(qaExp)qaExp.addEventListener('click',function(){doExport();});

  var logoutBtn=document.getElementById('adminLogoutBtn');
  if(logoutBtn){
    logoutBtn.addEventListener('click',function(){
      try{localStorage.removeItem(AUTH_TOKEN_KEY);}catch(e){}
      window.location.href='/';
    });
  }

  var allUsersBody=document.getElementById('allUsersBody');
  if(allUsersBody){
    allUsersBody.addEventListener('click',function(e){
      var btn=e.target.closest('[data-action]');
      if(!btn)return;
      var action=btn.dataset.action;
      var id=btn.dataset.id;
      if(!id)return;
      if(action==='edit'){
        var u=getUserById(id)||{};
        var name=prompt('Имя пользователя:',u.name||'');
        if(name===null)return;
        var email=prompt('Email пользователя:',u.email||'');
        if(email===null)return;
        updateUserAdmin(id,{name:name,email:email}).catch(function(err){
          alert('Ошибка: '+(err.message||'не удалось обновить'));
        });
        return;
      }
      if(action==='block'){
        if(!confirm('Заблокировать пользователя?'))return;
        setUserBlocked(id,true).catch(function(err){
          alert('Ошибка: '+(err.message||'не удалось заблокировать'));
        });
        return;
      }
      if(action==='unblock'){
        if(!confirm('Разблокировать пользователя?'))return;
        setUserBlocked(id,false).catch(function(err){
          alert('Ошибка: '+(err.message||'не удалось разблокировать'));
        });
      }
    });
  }

  initSettingsInputs();
}

if(document.readyState==='complete' || document.readyState==='interactive'){
  setTimeout(bootAdmin,0);
}else{
  window.addEventListener('load',bootAdmin);
}



// -- ACTIVITY CHART --

function buildActChart(dataArr){
  if(!window.Chart)return;

  var data=dataArr&&dataArr.length?dataArr:[0,0,0,0,0,0,0,0,0,0,0,0];

  var el=document.getElementById('actChart');
  if(!el)return;
  destroyChartFor(el);
  new Chart(el,{type:'bar',

    data:{labels:['00','02','04','06','08','10','12','14','16','18','20','22'],datasets:[{data:data,backgroundColor:'rgba(79,135,245,0.45)',borderColor:'#4F87F5',borderWidth:1.5,borderRadius:4,borderSkipped:false}]},

    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:TT},scales:{x:{grid:{display:false},ticks:TK},y:{grid:GR,ticks:TK}}}});

}



// -- AI CHARTS --

function buildAiCharts(ai,attempt){
  if(!window.Chart){
    ensureChart().then(function(){buildAiCharts(ai);});
    return;
  }
  var tryCount=attempt||0;
  var probeEl=document.getElementById('aiReqChart')||document.getElementById('aiLatChart')||document.getElementById('aiTokChart');
  if(probeEl){
    var pw=(probeEl.parentNode&&probeEl.parentNode.clientWidth)||probeEl.clientWidth||0;
    var ph=(probeEl.parentNode&&probeEl.parentNode.clientHeight)||probeEl.clientHeight||0;
    if((!pw||pw<10||!ph||ph<10) && tryCount<8){
      setTimeout(function(){buildAiCharts(ai,tryCount+1);},140);
      return;
    }
  }

  var now=new Date();
  const hrs=[];
  for(var i=11;i>=0;i--){
    var d=new Date(now.getTime() - i*2*3600000);
    hrs.push(String(d.getHours()).padStart(2,'0'));
  }
  const reqDataRaw=(ai&&Array.isArray(ai.requestsBy2h))?ai.requestsBy2h:new Array(12).fill(0);
  const latDataRaw=(ai&&Array.isArray(ai.latencyBy2h))?ai.latencyBy2h:new Array(12).fill(0);
  // server buckets are from "now -> past", chart should show past -> now
  const reqData=reqDataRaw.slice().reverse();
  const latData=latDataRaw.slice().reverse();
  function smoothSeries(arr){
    if(!arr||arr.length<3)return arr;
    var out=new Array(arr.length).fill(0);
    for(var i=0;i<arr.length;i++){
      var a=arr[i-1]||0;
      var b=arr[i]||0;
      var c=arr[i+1]||0;
      out[i]=(a+b+c)/3;
    }
    return out;
  }
  const reqDataSm=smoothSeries(reqData);
  const latDataSm=smoothSeries(latData);
  const tokLabels=(ai&&Array.isArray(ai.tokens7dLabels))?ai.tokens7dLabels:['','','','','','',''];
  const tokData=(ai&&Array.isArray(ai.tokens7d))?ai.tokens7d:new Array(7).fill(0);

  function syncCanvasSize(el){
    if(!el||!el.parentNode)return;
    var w=el.parentNode.clientWidth||el.clientWidth||0;
    var h=el.parentNode.clientHeight||el.clientHeight||0;
    if(w&&h){
      el.width=w;
      el.height=h;
      el.style.width=w+'px';
      el.style.height=h+'px';
    }
  }

  function mini(id,data,color){
    var el=document.getElementById(id);
    if(!el)return;
    syncCanvasSize(el);
    destroyChartFor(el);
    new Chart(el,{type:'line',
      data:{labels:hrs,datasets:[{data,borderColor:color,backgroundColor:color.replace('rgb(','rgba(').replace(')',',0.08)'),tension:0.4,fill:true,pointRadius:0,borderWidth:1.6}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{enabled:false}},scales:{x:{display:false},y:{display:false}}}});
  }

  mini('aiReqChart',reqDataSm,'rgb(201,168,76)');
  mini('aiLatChart',latDataSm,'rgb(224,160,48)');

  var tokEl=document.getElementById('aiTokChart');
  if(tokEl){
    syncCanvasSize(tokEl);
    destroyChartFor(tokEl);
    new Chart(tokEl,{type:'bar',
      data:{labels:tokLabels,datasets:[{label:'Tokens',data:tokData,backgroundColor:'rgba(79,135,245,0.4)',borderColor:'#4F87F5',borderWidth:1.5,borderRadius:4,borderSkipped:false}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:TT},scales:{x:{grid:{display:false},ticks:TK},y:{grid:GR,ticks:TK}}}});
  }
}

// -- ANALYTICS CHARTS --

function buildAnalytics(dash,attempt){
  if(!window.Chart){
    ensureChart().then(function(){buildAnalytics(dash,attempt||0);});
    return;
  }
  var chartEl=document.getElementById('anBarChart');
  if(!chartEl)return;
  var w=(chartEl.parentNode&&chartEl.parentNode.clientWidth)||chartEl.clientWidth||0;
  if((!w||w<10) && (attempt||0)<8){
    setTimeout(function(){buildAnalytics(dash,(attempt||0)+1);},140);
    return;
  }
  destroyChartFor(chartEl);

  var labels=(dash&&dash.growth&&dash.growth.labels)||[];
  var users=(dash&&dash.growth&&dash.growth.users)||[];
  var caps=(dash&&dash.growth&&dash.growth.capsules)||[];

  if(!labels.length){
    var now=new Date();
    var months=['\u044f\u043d\u0432.','\u0444\u0435\u0432.','\u043c\u0430\u0440\u0442','\u0430\u043f\u0440.','\u043c\u0430\u0439','\u0438\u044e\u043d\u044c','\u0438\u044e\u043b\u044c','\u0430\u0432\u0433.','\u0441\u0435\u043d\u0442.','\u043e\u043a\u0442.','\u043d\u043e\u044f\u0431.','\u0434\u0435\u043a.'];
    labels=[];
    for(var i=11;i>=0;i--){
      var d=new Date(now.getFullYear(),now.getMonth()-i,1);
      labels.push(months[d.getMonth()]+' '+String(d.getFullYear()).slice(-2));
    }
    users=new Array(labels.length).fill(0);
    caps=new Array(labels.length).fill(0);
  }
  if(users.length<labels.length){users=labels.map(function(_,i){return users[i]||0;});}
  if(caps.length<labels.length){caps=labels.map(function(_,i){return caps[i]||0;});}
  if(w && w>10){
    chartEl.width=w;
    chartEl.height=160;
  }

  new Chart(chartEl,{type:'bar',

    data:{labels:labels,

      datasets:[

        {label:'\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438',data:users,backgroundColor:'rgba(201,168,76,0.5)',borderColor:'#C9A84C',borderWidth:1.5,borderRadius:4,borderSkipped:false},

        {label:'\u041a\u0430\u043f\u0441\u0443\u043b\u044b',data:caps,backgroundColor:'rgba(31,201,154,0.35)',borderColor:'#1FC99A',borderWidth:1.5,borderRadius:4,borderSkipped:false}

      ]},

    options:{responsive:false,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},

      plugins:{legend:{labels:{color:'rgba(244,244,246,0.55)',font:F,boxWidth:8,boxHeight:8,usePointStyle:true,pointStyle:'circle',padding:16}},tooltip:TT},

      scales:{x:{grid:{display:false},ticks:TK},y:{grid:GR,ticks:TK}}}});

  var traffic=(dash&&dash.analytics&&dash.analytics.traffic)||{direct:100,social:0,search:0,referral:0};
  var tvals=[traffic.direct||0,traffic.social||0,traffic.search||0,traffic.referral||0];
  var tsum=tvals.reduce(function(a,b){return a+b;},0);
  if(!tsum){tvals=[100,0,0,0];}
  buildDonut('trafDonut',tvals,['\u041f\u0440\u044f\u043c\u043e\u0439','\u0421\u043e\u0446\u0441\u0435\u0442\u0438','\u041f\u043e\u0438\u0441\u043a','\u0420\u0435\u0444\u0435\u0440\u0430\u043b'],['#4F87F5','#1FC99A','#C9A84C','#9270EF']);
  var legend=document.querySelectorAll('#pg-analytics .dleg .dlp');
  if(legend && legend.length>=4){
    legend[0].textContent=tvals[0]+'%';
    legend[1].textContent=tvals[1]+'%';
    legend[2].textContent=tvals[2]+'%';
    legend[3].textContent=tvals[3]+'%';
  }

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
    try{localStorage.setItem('adminNotifClearedAt',String(Date.now()));}catch(e){}

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

      if(list)list.innerHTML='<div style="padding:32px 16px;text-align:center;color:var(--g2);font-size:12.5px">Нет уведомлений</div>';

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
  var em=(document.getElementById('pEmail')||{value:''}).value.trim();
  var profile={firstName:fn,lastName:ln,name:(fn+' '+ln).trim(),email:em,avatar:localStorage.getItem('adminAvatar')||''};
  applyProfileData(profile,true);
  apiAdmin('/api/admin/profile',{method:'POST',body:JSON.stringify(profile)}).catch(function(){});
  closeModal();
});}

var _ai=document.getElementById('avatarInput');

if(_ai){_ai.addEventListener('change',function(){

  if(!this.files||!this.files[0])return;

  var r=new FileReader();

  r.onload=function(e){

    var s=e.target.result;
    localStorage.setItem('adminAvatar',s);

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

  var pts=window.MAP_POINTS||[];

  pts.forEach(function(p){

    var r=Math.max(7,Math.min(22,Math.round(Math.log(p.count/50+1)*5)));

    var c=L.circleMarker([p.lat,p.lng],{radius:r,color:p.col,fillColor:p.col,fillOpacity:0.75,weight:2}).addTo(map);

    c.bindPopup('<div style="background:#1E1E24;border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:10px 13px;color:#F4F4F6;font-family:DM Sans,sans-serif"><b style="font-size:13px">'+p.city+'</b><br><span style="font-size:11px;color:rgba(244,244,246,0.5)">Capsules: <b style="color:'+p.col+'">'+p.count+'</b></span></div>');

  });

}





window.addEventListener('resize',function(){if(LC)LC.resize();});





function doExport(){

  var sel=document.getElementById('lineSelect');
  var v=sel&&sel.value;
  var d=(v==='12')?D12:(v==='7d')?D7D:D7;

  var rows=[v==='7d'?'Day,Users,Capsules':'Month,Users,Capsules'];

  d.L.forEach(function(l,i){rows.push(l+','+d.u[i]+','+d.c[i]);});

  var csv=rows.join('\n');

  var blob=new Blob([csv],{type:'text/csv'});

  var url=URL.createObjectURL(blob);

  var a=document.createElement('a');a.href=url;a.download='users-growth.csv';a.click();

  URL.revokeObjectURL(url);

}

// -- EXPORT CSV --

// -- LIVE ADMIN STATS --

const AUTH_TOKEN_KEY='dfm_token';

window.DASH_DATA=null;

window.MAP_POINTS=[];

function fmtNum(n){return Number(n||0).toLocaleString('ru-RU');}

function fmtShort(n){

  const v=Number(n||0);

  if(v>=1e6)return (v/1e6).toFixed(1).replace(/\.0$/,'')+'M';

  if(v>=1e3)return (v/1e3).toFixed(1).replace(/\.0$/,'')+'k';

  return String(v);

}

function fmtDate(d){

  if(!d)return '-';

  try{

    return new Date(d).toLocaleDateString('ru-RU',{day:'2-digit',month:'short',year:'numeric'});

  }catch(e){return '-';}

}

function fixMojibakeText(value){
  if(value===null||value===undefined)return '';
  var text=String(value);
  if(!text)return text;
  function scoreCyr(s){return (s.match(/[Ѐ-ӿ]/g)||[]).length;}
  var best=text;
  var bestScore=scoreCyr(text);
  try{
    var bytes=Uint8Array.from(text,function(ch){return ch.charCodeAt(0)&0xFF;});
    var decoded=new TextDecoder('utf-8',{fatal:false}).decode(bytes);
    var sc=scoreCyr(decoded);
    if(sc>bestScore){best=decoded;bestScore=sc;}
  }catch(e){}
  try{
    var bytes2=[];
    for(var i=0;i<text.length;i++){
      var c=text.charCodeAt(i);
      if(c===0x0401) bytes2.push(0xA8);
      else if(c===0x0451) bytes2.push(0xB8);
      else if(c>=0x0410 && c<=0x044F) bytes2.push(c-0x0350);
      else if(c<=0x00FF) bytes2.push(c);
      else bytes2.push(0x3F);
    }
    var decoded2=new TextDecoder('utf-8',{fatal:false}).decode(Uint8Array.from(bytes2));
    var sc2=scoreCyr(decoded2);
    if(sc2>bestScore){best=decoded2;bestScore=sc2;}
  }catch(e){}
  return best;
}

function fixText(value){
  return fixMojibakeText(value);
}

function cleanLabel(value){
  var t=fixText(value);
  if(!t)return '';
  t=String(t).replace(/\s+/g,' ').trim();
  t=t.replace(/^[\u040E\u045E\uFFFD]+/g,'');
  try{
    t=t.replace(/^[^\p{L}\p{N}]+/u,'');
  }catch(e){
    t=t.replace(/^[^A-Za-z0-9\u0410-\u044F\u0401\u0451]+/,'');
  }
  return t.trim();
}

function repairMojibakeInDom(root){
  if(!root||!root.querySelectorAll)return;
  var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null);
  var nodes=[];
  while(walker.nextNode()){nodes.push(walker.currentNode);}
  nodes.forEach(function(node){
    var fixed=fixMojibakeText(node.nodeValue);
    if(fixed!==node.nodeValue)node.nodeValue=fixed;
  });
}

function setAvatarImages(src){
  if(!src)return;
  var pi=document.getElementById('profileAvaImg');
  if(pi){pi.src=src;pi.style.display='block';}
  var pa=document.getElementById('profileAva');
  if(pa){var t=pa.childNodes[0];if(t&&t.nodeType===3)t.nodeValue='';}
  var si=document.getElementById('sidebarAvaImg');
  if(si){si.src=src;si.style.display='block';}
  var sa=document.getElementById('sidebarAva');
  if(sa){var t2=sa.childNodes[0];if(t2&&t2.nodeType===3)t2.nodeValue='';}
  var tb=document.getElementById('profileTopBtn');
  if(tb){
    var img=document.getElementById('topAvaImg');
    if(!img){img=document.createElement('img');img.id='topAvaImg';img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%';tb.style.position='relative';tb.appendChild(img);}    
    img.src=src;img.style.display='block';
    var txt=tb.childNodes[0];if(txt&&txt.nodeType===3)txt.nodeValue='';
  }
  var da=document.getElementById('dropAva');
  if(da){
    da.style.background='none';da.style.padding='0';da.style.overflow='hidden';
    var dimg=da.querySelector('img')||document.createElement('img');
    dimg.src=src;dimg.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:50%;display:block';
    if(!da.querySelector('img'))da.appendChild(dimg);
    var dtxt=da.childNodes[0];if(dtxt&&dtxt.nodeType===3)dtxt.nodeValue='';
  }
}

function applyProfileData(profile,persist){
  if(!profile)return;
  var first=(profile.firstName||profile.first||'').trim();
  var last=(profile.lastName||profile.last||'').trim();
  var name=(profile.name||((first||last)?(first+' '+last):'')).trim();
  var email=(profile.email||'').trim();
  var avatar=profile.avatar||profile.avatarUrl||'';
  if(persist){
    if(name) localStorage.setItem('adminName',name); else localStorage.removeItem('adminName');
    if(first) localStorage.setItem('adminFirst',first); else localStorage.removeItem('adminFirst');
    if(last) localStorage.setItem('adminLast',last); else localStorage.removeItem('adminLast');
    if(email) localStorage.setItem('adminEmail',email); else localStorage.removeItem('adminEmail');
    if(avatar) localStorage.setItem('adminAvatar',avatar);
  }
  if(name){
    var un=document.querySelector('.u-name');if(un)un.textContent=name;
    var dn=document.getElementById('dropName');if(dn)dn.textContent=name;
  }
  var fn=document.getElementById('pFirstName');if(fn && first)fn.value=first;
  var ln=document.getElementById('pLastName');if(ln && last)ln.value=last;
  var em=document.getElementById('pEmail');if(em)em.value=email;
  if(avatar){setAvatarImages(avatar);}
}

function applyStoredProfile(){
  var profile={
    name:localStorage.getItem('adminName')||'',
    firstName:localStorage.getItem('adminFirst')||'',
    lastName:localStorage.getItem('adminLast')||'',
    email:localStorage.getItem('adminEmail')||'',
    avatar:localStorage.getItem('adminAvatar')||''
  };
  applyProfileData(profile,false);
  if(!profile.avatar && window.DEFAULT_ADMIN_AVA){
    setAvatarImages(window.DEFAULT_ADMIN_AVA);
  }
}

function applySettingsData(settings,persist){
  if(!settings)return;
  var name=(settings.siteName||settings.name||'').trim();
  var email=(settings.supportEmail||settings.email||'').trim();
  if(persist){
    if(name) localStorage.setItem('adminSiteName',name); else localStorage.removeItem('adminSiteName');
    if(email) localStorage.setItem('adminSupportEmail',email); else localStorage.removeItem('adminSupportEmail');
  }
  var nameInput=document.getElementById('siteNameInput');
  var emailInput=document.getElementById('supportEmailInput');
  if(nameInput && name)nameInput.value=name;
  if(emailInput && email)emailInput.value=email;
  if(name){
    document.title=name+' ? Admin';
    var sbTitle=document.querySelector('.sb-title');
    if(sbTitle)sbTitle.textContent=name;
  }
}

function applyStoredSettings(){
  var name=localStorage.getItem('adminSiteName')||'';
  var email=localStorage.getItem('adminSupportEmail')||'';
  applySettingsData({siteName:name,supportEmail:email},false);
}

function initSettingsInputs(){
  var nameInput=document.getElementById('siteNameInput');
  var emailInput=document.getElementById('supportEmailInput');
  var t=null;
  function save(){
    var payload={
      siteName:(nameInput&&nameInput.value||'').trim(),
      supportEmail:(emailInput&&emailInput.value||'').trim()
    };
    if(payload.siteName){
      document.title=payload.siteName+' ? Admin';
      var sbTitle=document.querySelector('.sb-title');
      if(sbTitle)sbTitle.textContent=payload.siteName;
    }
    if(payload.siteName) localStorage.setItem('adminSiteName',payload.siteName); else localStorage.removeItem('adminSiteName');
    if(payload.supportEmail) localStorage.setItem('adminSupportEmail',payload.supportEmail); else localStorage.removeItem('adminSupportEmail');
    if(t)clearTimeout(t);
    t=setTimeout(function(){
      apiAdmin('/api/admin/settings',{method:'POST',body:JSON.stringify(payload)}).catch(function(){});
    },200);
  }
  if(nameInput){
    nameInput.addEventListener('input',save);
    nameInput.addEventListener('change',save);
    nameInput.addEventListener('blur',save);
  }
  if(emailInput){
    emailInput.addEventListener('input',save);
    emailInput.addEventListener('change',save);
    emailInput.addEventListener('blur',save);
  }
}

function scheduleDashboardCharts(){
  if(!window.DASH_DATA)return;
  ensureChart().then(function(){
    var tries=0;
    (function tick(){
      tries++;
      safeCall(function(){buildLine(D7);});
      if(tries<12){setTimeout(tick,250);}    
    })();
  });
}

function scheduleAnalyticsCharts(){
  if(!window.DASH_DATA)return;
  ensureChart().then(function(){
    var tries=0;
    (function tick(){
      tries++;
      safeCall(function(){buildAnalytics(window.DASH_DATA,0);});
      if(tries<12){setTimeout(tick,250);}    
    })();
  });
}

function scheduleAnalyticsCharts(){
  if(!window.DASH_DATA)return;
  ensureChart().then(function(){
    var tries=0;
    (function tick(){
      tries++;
      safeCall(function(){buildAnalytics(window.DASH_DATA,0);});
      if(tries<6){setTimeout(tick,250);}
    })();
  });
}

function ensureChart(){
  return new Promise(function(resolve){
    if(window.Chart){resolve();return;}
    var existing=document.getElementById('chart-lib');
    if(existing){existing.addEventListener('load',resolve,{once:true});return;}
    var s=document.createElement('script');
    s.id='chart-lib';
    s.src='/chart.umd.min.js';
    s.onload=function(){resolve();};
    s.onerror=function(){
      var cdn=document.createElement('script');
      cdn.src='https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
      cdn.onload=function(){resolve();};
      cdn.onerror=function(){resolve();};
      document.head.appendChild(cdn);
    };
    document.head.appendChild(s);
  });
}

function setStat(name,value){

  document.querySelectorAll('[data-stat="'+name+'"]').forEach(el=>{el.textContent=value;});

}

async function apiAdmin(url,opts={}){

  const headers={...(opts.headers||{})};

  const token=localStorage.getItem(AUTH_TOKEN_KEY)||'';

  if(token)headers.Authorization='Bearer '+token;

  if(!headers['Content-Type']&&opts.body)headers['Content-Type']='application/json';

  const res=await fetch(url,{...opts,headers,cache:'no-store'});

  const data=await res.json().catch(()=>({}));

  if(!res.ok)throw new Error(data.error||'Request failed');

  return data;

}

function applySummary(s,dash){

  const users=Number(s.users||0);

  const premium=Number(s.premiumUsers||0);

  const publicCaps=Number(s.publicCapsules||0);

  const totalCaps=Number(s.totalCapsules||0);

  const unusedPromo=Number(s.unusedPromoCodes||0);

  setStat('users',fmtNum(users));

  setStat('premiumUsers',fmtNum(premium));

  setStat('publicCapsules',fmtNum(publicCaps));

  setStat('usersShort',fmtShort(users));

  setStat('capsulesShort',fmtShort(totalCaps));

  setStat('unusedPromoCodes',fmtNum(unusedPromo));

  setStat('newUsersMonth',fmtNum(s.newUsersMonth||0));

  setStat('deliveredToday',fmtNum(s.deliveredToday||0));

  setStat('conversion',(s.conversion||0).toFixed(1)+'%');

  setStat('revenue','$'+fmtNum(s.revenue||0));

  setStat('avgCheck','$'+fmtNum(s.avgCheck||0));

  setStat('activeUsers30',fmtNum(s.activeUsers30||0));

  setStat('blockedUsers',fmtNum(s.blockedUsers||0));

  setStat('pendingDelivery',fmtNum(s.pendingDelivery||0));

  setStat('deliveredTotal',fmtNum(s.deliveredTotal||0));

  setStat('secretCapsules',fmtNum(s.secretCapsules||0));

  var analytics=dash&&dash.analytics||{};

  var retention=analytics.retention30;
  if(retention===undefined||retention===null){
    retention=users?((s.activeUsers30||0)/users*100):0;
  }
  setStat('retention30',Number(retention||0).toFixed(1)+'%');

  var capsPerUser=analytics.capsulesPerUser;
  if(capsPerUser===undefined||capsPerUser===null){
    capsPerUser=users?(totalCaps/users):0;
  }
  setStat('capsulesPerUser',Number(capsPerUser||0).toFixed(1));

  var avgSession=analytics.avgSessionMin||0;
  setStat('avgSession',Number(avgSession||0).toFixed(1).replace(/\.0$/,'')+' \u043c\u0438\u043d');

  var refSources=analytics.refSources||0;
  setStat('refSources',fmtNum(refSources));

  setStat('countriesCount',fmtNum((dash.countries||[]).length));

  setStat('hotspotsCount',fmtNum((dash.mapPoints||[]).length));

  setStat('citiesCount',fmtNum((dash.mapPoints||[]).length));

  setStat('reviewsTotal',fmtNum((dash.reviews&&dash.reviews.total)||0));

  setStat('reviewsNew','0');

  setStat('reviewsAvg',((dash.reviews&&dash.reviews.avg)||0).toFixed(1));

  setStat('reviewsPublished',fmtNum((dash.reviews&&dash.reviews.published)|| (dash.reviews&&dash.reviews.total)||0));

  var reviewsTotal=(dash.reviews&&dash.reviews.total)!=null ? (dash.reviews&&dash.reviews.total) : 0;
  setStat('reviewsPending',fmtNum(reviewsTotal));

  setStat('reviewsComplaints',fmtNum((dash.reviews&&dash.reviews.complaints)||0));

  setStat('todayRegistrations',fmtNum((dash.today&&dash.today.registrations)||0));

  setStat('todayCapsules',fmtNum((dash.today&&dash.today.capsulesCreated)||0));

  setStat('todayDelivered',fmtNum((dash.today&&dash.today.delivered)||0));

  setStat('todayPayments','$'+fmtNum((dash.today&&dash.today.payments)||0));

  setStat('todayDeletions',fmtNum((dash.today&&dash.today.deletions)||0));

  setStat('freeUsers',fmtNum(Math.max(users-premium,0))+' \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u0439');

  setStat('premiumUsersCard',fmtNum(premium)+' \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u0439');

  setStat('aiGuardUsers',fmtNum(analytics.aiGuardUsers||0)+' \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u0439');

  var ct=document.getElementById('capsuleTotal');if(ct)ct.textContent=fmtShort(totalCaps);

}

function renderCountries(list){

  var wrap=document.getElementById('countriesList');if(!wrap)return;

  const max=list.length?Math.max.apply(null,list.map(x=>x.count)):0;

  wrap.innerHTML=list.map(function(c,i){

    var w=max?Math.round(c.count/max*100):0;

    var col=['#C9A84C','#4F87F5','#1FC99A','#9270EF','#E85050'][i%5];

    return '<div class="mb-row"><span style="font-size:14px">\u{1F30D}</span><div class="mb-name">'+cleanLabel(c.name)+'</div><div class="mb-bar"><div class="mb-fill" style="width:'+w+'%;background:'+col+'"></div></div><div class="mb-num">'+fmtNum(c.count)+'</div></div>';

  }).join('') || '<div style="padding:10px 16px;color:var(--g2);font-size:12px">Нет данных</div>';

}

function renderRegions(points){

  var wrap=document.getElementById('regionsList');if(!wrap)return;

  const max=points.length?Math.max.apply(null,points.map(x=>x.count)):0;

  wrap.innerHTML=points.map(function(p,i){

    var w=max?Math.round(p.count/max*100):0;

    var col=['#C9A84C','#4F87F5','#1FC99A','#9270EF','#E85050'][i%5];

    return '<div class="mb-row"><span style="font-size:14px">\u{1F4CD}</span><div class="mb-name">'+cleanLabel(p.city)+'</div><div class="mb-bar"><div class="mb-fill" style="width:'+w+'%;background:'+col+'"></div></div><div class="mb-num">'+fmtNum(p.count)+'</div></div>';

  }).join('') || '<div style="padding:10px 16px;color:var(--g2);font-size:12px">Нет данных</div>';

}

function renderActivity(list,elId,limit){

  var wrap=document.getElementById(elId);if(!wrap)return;

  var items=(list||[]).slice(0,limit||10);

  wrap.innerHTML=items.map(function(e){

    var time=new Date(e.time).toLocaleString('ru-RU',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});

    var col=e.type==='capsule'?'#4F87F5':e.type==='premium'?'#C9A84C':e.type==='delivered'?'#9270EF':'#1FC99A';

    return '<div class="ai"><div class="ai-col"><div class="ai-dot" style="background:'+col+'"></div><div class="ai-line"></div></div><div><div class="ai-text">'+fixText(e.text)+'</div><div class="ai-time">'+time+'</div></div></div>';

  }).join('') || '<div style="padding:12px 16px;color:var(--g2);font-size:12px">Нет событий</div>';

}

function renderUsers(list){
  var allBody=document.getElementById('allUsersBody');
  var lastBody=document.getElementById('lastUsersBody');
  var users=Array.isArray(list)?list:[];

  function planBadge(u){
    var isPremium=!!u.premium || (u.premiumUntil && new Date(u.premiumUntil).getTime()>Date.now());
    return isPremium ? '<span class="badge go">Premium</span>' : '<span class="badge gy">Бесплатно</span>';
  }

  function statusBadge(u){
    var blocked=!!u.blockedAt || u.status==='blocked' || u.isBlocked;
    return blocked ? '<span class="badge re">Заблокирован</span>' : '<span class="badge gr">Активен</span>';
  }

  function avatarCell(u){
    var name=fixText(u.name||'Пользователь');
    var email=fixText(u.email||'');
    var initials=(name||'').split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase()||'U';
    return '<div class="tdu">'+
      '<div class="tda" style="background:var(--gb);color:var(--gold)">'+initials+'</div>'+
      '<div><div class="tdn">'+name+'</div><div class="tde">'+email+'</div></div>'+
    '</div>';
  }

  if(lastBody){
    var lastRows=users.slice(0,5).map(function(u){
      return '<tr>'+
        '<td>'+avatarCell(u)+'</td>'+
        '<td class="tdm">—</td>'+
        '<td>'+planBadge(u)+'</td>'+
        '<td class="tdm">'+fmtNum(u.capsuleCount||0)+'</td>'+
        '<td>'+statusBadge(u)+'</td>'+
        '<td class="tdm">'+fmtDate(u.createdAt)+'</td>'+
      '</tr>';
    }).join('');
    lastBody.innerHTML=lastRows || '<tr><td colspan="6" class="tdm" style="text-align:center">Нет данных</td></tr>';
  }

  if(allBody){
    var allRows=users.map(function(u){
      var blocked=!!u.blockedAt || u.status==='blocked' || u.isBlocked;
      var actionBtn=blocked
        ? '<div class="btn" style="color:var(--grn);border-color:var(--gnb)" data-action="unblock" data-id="'+(u.id||'')+'">Разблок</div>'
        : '<div class="btn" style="color:var(--red);border-color:var(--rb)" data-action="block" data-id="'+(u.id||'')+'">Блок</div>';
      return '<tr>'+
        '<td>'+avatarCell(u)+'</td>'+
        '<td class="tdm">—</td>'+
        '<td>'+planBadge(u)+'</td>'+
        '<td class="tdm">'+fmtNum(u.capsuleCount||0)+'</td>'+
        '<td class="tdm">'+(u.lastLogin?fmtDate(u.lastLogin):'—')+'</td>'+
        '<td>'+statusBadge(u)+'</td>'+
        '<td><div style="display:flex;gap:6px"><div class="btn" data-action="edit" data-id="'+(u.id||'')+'">Изменить</div>'+actionBtn+'</div></td>'+
      '</tr>';
    }).join('');
    allBody.innerHTML=allRows || '<tr><td colspan="7" class="tdm" style="text-align:center">Нет данных</td></tr>';
  }
}

function renderCapsules(list){
  var body=document.getElementById('capsulesBody');
  if(!body)return;
  var caps=Array.isArray(list)?list:[];
  var now=Date.now();
  function typeMeta(t){
    switch(String(t||'').toLowerCase()){
      case 'photo': return {label:'С фото',badge:'bl'};
      case 'voice': return {label:'Голосовая',badge:'gr'};
      case 'secret': return {label:'Секретная',badge:'pu'};
      default: return {label:'Текстовая',badge:'go'};
    }
  }
  var rows=caps.map(function(c){
    var type=typeMeta(c.type);
    var delivered=!!c.deliveredAt;
    var openTime=c.openDate?new Date(c.openDate).getTime():0;
    var statusLabel=delivered?'Доставлена':(openTime && openTime>now?'Ожидает':'Ожидает');
    var statusBadge=delivered?'gr':'am';
    return '<tr>'+
      '<td class="tdm">#'+String(c.id||'').slice(0,6)+'</td>'+
      '<td><div class="tdu"><div class="tda" style="background:var(--gb);color:var(--gold)">'+(String(c.name||'U').slice(0,2).toUpperCase())+'</div><div class="tdn">'+fixText(c.name||'Пользователь')+'</div></div></td>'+
      '<td><span class="badge '+type.badge+'">'+type.label+'</span></td>'+
      '<td class="tdm">'+fmtDate(c.createdAt)+'</td>'+
      '<td class="tdm">'+(c.openDate?fmtDate(c.openDate):'—')+'</td>'+
      '<td><span class="badge '+statusBadge+'">'+statusLabel+'</span></td>'+
    '</tr>';
  }).join('');
  body.innerHTML=rows || '<tr><td colspan="6" class="tdm" style="text-align:center">Нет данных</td></tr>';
}

async function deletePromoAdmin(code){
  var c=String(code||'').trim();
  if(!c)return;
  if(!confirm('Удалить промокод '+c+'?'))return;
  try{
    await apiAdmin('/api/admin/promo/delete',{method:'POST',body:JSON.stringify({code:c})});
    loadDashboard();
  }catch(e){
    alert('Ошибка: '+(e.message||'не удалось удалить'));
  }
}

async function deleteReviewAdmin(id){
  if(!id)return;
  if(!confirm('Delete review?'))return;
  try{
    await apiAdmin('/api/admin/reviews/delete',{method:'POST',body:JSON.stringify({id:id})});
    await loadDashboard();
  }catch(e){
    alert('Error: '+(e.message||'delete failed'));
  }
}

function getUserById(id){
  var list=(window.DASH_DATA&&window.DASH_DATA.usersList)||[];
  return list.find(function(u){return String(u.id)===String(id);});
}

async function updateUserAdmin(id,payload){
  if(!id)return;
  await apiAdmin('/api/admin/users/update',{method:'POST',body:JSON.stringify({id:id,...payload})});
  await loadDashboard();
}

async function setUserBlocked(id,blocked){
  if(!id)return;
  await apiAdmin('/api/admin/users/block',{method:'POST',body:JSON.stringify({id:id,blocked:!!blocked})});
  await loadDashboard();
}



function timeAgo(ts){
  if(!ts)return '';
  var diff=Math.max(0,Date.now()-new Date(ts).getTime());
  var m=Math.round(diff/60000);
  if(m<1)return 'только что';
  if(m<60)return m+' мин назад';
  var h=Math.round(m/60);
  if(h<24)return h+' ч назад';
  var d=Math.round(h/24);
  return d+' дн назад';
}

function renderNotifications(list){
  var wrap=document.querySelector('.notif-list');
  if(!wrap)return;
  var clearedAt=0;
  try{clearedAt=Number(localStorage.getItem('adminNotifClearedAt')||0);}catch(e){clearedAt=0;}
  var items=(list||[]).filter(function(e){
    if(!clearedAt)return true;
    var t=e&&e.time?new Date(e.time).getTime():0;
    return t>clearedAt;
  }).slice(0,3);
  var dot=document.getElementById('notifDot');
  if(!items.length){
    wrap.innerHTML='<div style="padding:32px 16px;text-align:center;color:var(--g2);font-size:12.5px">Нет уведомлений</div>';
    if(dot){dot.style.display='none';}
    return;
  }
  wrap.innerHTML=items.map(function(e){
    var bg=e.type==='premium'?'var(--gb)':e.type==='capsule'?'var(--gnb)':e.type==='delivered'?'var(--pb)':'var(--blb)';
    var color=e.type==='premium'?'var(--gold)':e.type==='capsule'?'var(--grn)':e.type==='delivered'?'var(--pur)':'var(--blu)';
    return '<div class="notif-item unread" style="display:flex;align-items:flex-start;gap:10px;padding:11px 14px;border-bottom:1px solid var(--bd);cursor:pointer;background:rgba(201,168,76,0.03)">'+
      '<div style="width:32px;height:32px;border-radius:8px;background:'+bg+';display:flex;align-items:center;justify-content:center;flex-shrink:0"><span style="width:8px;height:8px;border-radius:50%;background:'+color+';display:block"></span></div>'+
      '<div style="flex:1"><div style="font-size:12.5px;color:var(--g1)">'+fixText(e.text)+'</div><div style="font-size:10.5px;color:var(--g2);margin-top:2px">'+timeAgo(e.time)+'</div></div>'+
      '<div style="width:6px;height:6px;border-radius:50%;background:var(--gold);margin-top:4px;flex-shrink:0"></div>'+
    '</div>';
  }).join('');
  if(dot){dot.style.display='block';dot.style.opacity='1';}
}

function formatDate(d){
  if(!d)return '?';
  var dt=new Date(d);
  if(!dt || isNaN(dt.getTime()))return '?';
  return dt.toLocaleDateString('ru-RU',{day:'2-digit',month:'short',year:'numeric'});
}



function renderReviews(reviews){
  var body=document.getElementById('revTableBody');
  if(!body)return;
  reviews=reviews||{};
  var items=Array.isArray(reviews.items)?reviews.items:[];
  if(!items.length){
    body.innerHTML='<tr><td class="tdm" colspan="6" style="text-align:center;color:var(--g2);padding:16px">Нет отзывов</td></tr>';
    return;
  }
  body.innerHTML=items.map(function(r){
    var rating=Math.max(0,Math.min(5,Number(r.rating||0)));
    var stars=[1,2,3,4,5].map(function(i){
      var fill=i<=rating?'#E0A030':'var(--g3)';
      return '<svg width="12" height="12" viewBox="0 0 24 24" style="fill:'+fill+'"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
    }).join('');
    var status=r.status||'published';
    var badge=status==='complaint'?'re':status==='pending'?'am':'gr';
    var statusText=status==='complaint'?'Жалоба':status==='pending'?'Ожидает':'Опубликован';
    var name=fixText(r.name||'');
    var email=fixText(r.email||'');
    var txt=fixText(r.text||'');
    return '<tr>'+
      '<td><div class="tdu"><div class="tda" style="background:var(--gb);color:var(--gold)">'+(name||'U').slice(0,2).toUpperCase()+'</div><div><div class="tdn">'+name+'</div><div class="tde">'+email+'</div></div></div></td>'+
      '<td><div style="display:flex;gap:2px">'+stars+'<span style="font-size:11px;color:var(--g2);margin-left:4px">'+rating.toFixed(1)+'</span></div></td>'+
      '<td style="max-width:280px"><div style="font-size:12.5px;color:var(--g1);line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+txt+'</div></td>'+
      '<td class="tdm">'+formatDate(r.createdAt)+'</td>'+
      '<td><span class="badge '+badge+'">'+statusText+'</span></td>'+
      '<td><div style="display:flex;gap:6px"><div class="btn" style="color:var(--red);border-color:var(--rb)" data-id="'+(r.id||'')+'" onclick="deleteReviewAdmin(this.dataset.id)">Удалить</div></div></td>'+
    '</tr>';
  }).join('');
}

function renderAiLog(list){
  var wrap=document.getElementById('aiLog');
  if(!wrap)return;
  var items=Array.isArray(list)?list:[];
  if(!items.length){
    wrap.innerHTML='<div style="padding:16px 18px;color:var(--g2);font-size:12px">Нет логов</div>';
    return;
  }
  wrap.innerHTML=items.map(function(item){
    var level=(item.level||'ok').toLowerCase();
    var cls=level==='err'||level==='error'?'er':level==='warn'?'wn':level==='info'?'in':'ok';
    var label=level==='err'||level==='error'?'ERR':level==='warn'?'WARN':level==='info'?'INFO':'OK';
    var message=fixText(item.message||'');
    var meta=[timeAgo(item.time)];
    if(item.requestId)meta.push('req: '+item.requestId);
    if(item.user)meta.push('user: '+fixText(item.user));
    return '<div class="lr"><div class="lv '+cls+'">'+label+'</div><div><div class="lm">'+message+'</div><div class="lmt"><span>'+meta.join(' · ')+'</span></div></div></div>';
  }).join('');
}

function applyAiSummary(ai){
  if(!ai)ai={};
  var status=ai.status||'Offline';
  var statusEl=document.getElementById('aiStatusText');
  if(statusEl)statusEl.textContent=status;
  var badgeEl=document.getElementById('aiStatusBadge');
  if(badgeEl)badgeEl.textContent=status;
  var statusSub=document.getElementById('aiStatusSub');
  if(statusSub)statusSub.textContent=(ai.model?ai.model+'  |  ':'')+(ai.uptime?ai.uptime+' uptime':'');
  var statusDot=document.getElementById('aiStatusDot');
  if(statusDot){
    statusDot.classList.remove('on','er');
    var st=status.toLowerCase();
    statusDot.classList.add((st==='online' || st==='idle')?'on':'er');
  }
  var latencyEl=document.getElementById('aiLatencyVal');
  if(latencyEl)latencyEl.textContent=((ai.avgLatency||0).toFixed(2).replace(/\.00$/,'')+'\u0441');
  var latencySub=document.getElementById('aiLatencySub');
  if(latencySub)latencySub.textContent=ai.latencyNote||'';
  var reqEl=document.getElementById('aiReqHourVal');
  if(reqEl)reqEl.textContent=fmtNum(ai.requestsPerHour||0);
  var reqSub=document.getElementById('aiReqSub');
  if(reqSub){
    if(ai.limitPerDay){
      if(ai.limitPerDayFree||ai.limitPerDayPremium){reqSub.textContent='?????: free '+fmtNum(ai.limitPerDayFree||0)+' / premium '+fmtNum(ai.limitPerDayPremium||0)+' ? ????????: '+fmtNum(ai.limitReachedUsers||0);}else{reqSub.textContent='???????? ? ?????';}
    }else{
      reqSub.textContent='нагрузка в норме';
    }
  }
  var errEl=document.getElementById('aiErrorsVal');
  if(errEl)errEl.textContent=fmtNum(ai.errors24h||0);
  var errSub=document.getElementById('aiErrSub');
  if(errSub){
    errSub.textContent=(ai.errors24h&&ai.errors24h>0)?'есть ошибки':'ошибок нет';
  }
  var menuBadge=document.getElementById('aiMenuBadge');
  if(menuBadge){
    var errCount=Number(ai.errors24h||0);
    if(errCount>0){
      menuBadge.textContent=fmtNum(errCount);
      menuBadge.style.display='';
      menuBadge.classList.add('r');
    }else{
      menuBadge.textContent='0';
      menuBadge.style.display='none';
    }
  }
}

function renderReviewSummary(reviews){

  var total = (reviews && reviews.total) ? reviews.total : 0;

  var breakdown = (reviews && reviews.breakdown) ? reviews.breakdown : null;

  var counts = breakdown || {5:0,4:0,3:0,2:0,1:0};

  var max = Math.max(counts[5]||0,counts[4]||0,counts[3]||0,counts[2]||0,counts[1]||0,1);

  [5,4,3,2,1].forEach(function(star){

    var c = counts[star]||0;

    var bar = document.querySelector('[data-review-bar="'+star+'"]');

    var cnt = document.querySelector('[data-review-count="'+star+'"]');

    if(bar) bar.style.width = total ? Math.round(c/total*100) + '%' : '0%';

    if(cnt) cnt.textContent = c;

  });

}

function renderPromoList(promos){
  var body=document.getElementById('promoBody');
  if(!body)return;
  if(!promos||!promos.length){
    body.innerHTML='<tr><td class="tdm" colspan="6" style="text-align:center;color:var(--g2);padding:16px">Нет промокодов</td></tr>';
    return;
  }
  body.innerHTML=promos.map(function(p){
    var status='Активен', badge='gr';
    if(p.disabledAt){status='Отключён'; badge='re';}
    else if(p.usedBy){status='Использован'; badge='gy';}
    var duration=p.duration==='year'?'1 год':'1 месяц';
    return '<tr>'+
      '<td class="tdm">'+(p.code||'')+'</td>'+
      '<td class="tdm">'+duration+'</td>'+
      '<td><span class="badge '+badge+'">'+status+'</span></td>'+
      '<td class="tdm">'+fmtDate(p.createdAt)+'</td>'+
      '<td class="tdm">'+(p.usedAt?fmtDate(p.usedAt):'-')+'</td>'+
      '<td><div class="btn" style="color:var(--red);border-color:var(--rb)" data-code="'+(p.code||'')+'" onclick="deletePromoAdmin(this.dataset.code)">Удалить</div></td>'+
    '</tr>';
  }).join('');
}

function updateDonut(typeCounts){

  var total=Object.values(typeCounts||{}).reduce((a,b)=>a+b,0);

  var data=[typeCounts.text||0,typeCounts.photo||0,typeCounts.voice||0,typeCounts.secret||0];

  var perc=total?data.map(v=>Math.round(v/total*100)):[0,0,0,0];

  var ct=document.getElementById('capsuleTotal');
  if(ct)ct.textContent=fmtNum(total);

  var pctEls=document.querySelectorAll('#pg-dashboard .dleg .dlp');

  pctEls.forEach(function(el,i){el.textContent=(perc[i]||0)+'%';});

  try{
    buildDonut('donutChart',perc,['\u0422\u0435\u043a\u0441\u0442\u043e\u0432\u044b\u0435','\u0421 \u0444\u043e\u0442\u043e','\u0413\u043e\u043b\u043e\u0441\u043e\u0432\u044b\u0435','\u0421\u0435\u043a\u0440\u0435\u0442\u043d\u044b\u0435'],['#C9A84C','#4F87F5','#1FC99A','#9270EF']);
  }catch(e){
    console.error(e);
  }

}

function safeCall(fn){
  try{fn();}catch(e){console.error(e);}
}

var DASH_LOAD_ATTEMPTS=0;

function goToPage(pg){
  var btn=document.querySelector('.nav-btn[data-pg="'+pg+'"]');
  if(btn)btn.click();
}

function csvEscape(val){
  var s=String(val==null?'':val);
  if(/[",\n]/.test(s)){
    return '"'+s.replace(/"/g,'""')+'"';
  }
  return s;
}

function exportAiLogs(){
  var logs=(window.DASH_DATA&&window.DASH_DATA.ai&&window.DASH_DATA.ai.logs)||[];
  if(!logs.length){
    alert('Нет логов для экспорта');
    return;
  }
  var rows=[['time','level','user','message']];
  logs.forEach(function(l){
    rows.push([
      l.time||'',
      l.level||'',
      fixText(l.user||''),
      fixText(l.message||'')
    ]);
  });
  var csv=rows.map(r=>r.map(csvEscape).join(',')).join('\n');
  var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url;
  a.download='ai-logs.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function(){URL.revokeObjectURL(url);},5000);
}

function showDashError(msg){
  var id='dashErrorBanner';
  var existing=document.getElementById(id);
  if(msg){
    if(!existing){
      existing=document.createElement('div');
      existing.id=id;
      existing.style.cssText='position:fixed;left:16px;right:16px;top:16px;z-index:9999;background:#2a1515;border:1px solid #5a2a2a;color:#f3c6c6;padding:10px 14px;border-radius:8px;font-size:12.5px;box-shadow:0 10px 30px rgba(0,0,0,0.35)';
      document.body.appendChild(existing);
    }
    existing.textContent=msg;
  }else if(existing){
    existing.parentNode.removeChild(existing);
  }
}

async function loadDashboard(){

  try{

    var dash=await apiAdmin('/api/admin/dashboard');

    window.DASH_DATA=dash;

    var labels=dash.growth&&dash.growth.labels||[];

    var users=dash.growth&&dash.growth.users||[];

    var caps=dash.growth&&dash.growth.capsules||[];

    if(!Array.isArray(labels) || !labels.length){
      labels=[];
      var now=new Date();
      var months=['\u044f\u043d\u0432.','\u0444\u0435\u0432.','\u043c\u0430\u0440\u0442','\u0430\u043f\u0440.','\u043c\u0430\u0439','\u0438\u044e\u043d\u044c','\u0438\u044e\u043b\u044c','\u0430\u0432\u0433.','\u0441\u0435\u043d\u0442.','\u043e\u043a\u0442.','\u043d\u043e\u044f\u0431.','\u0434\u0435\u043a.'];
      for(var i=11;i>=0;i--){
        var d=new Date(now.getFullYear(),now.getMonth()-i,1);
        labels.push(months[d.getMonth()]+' '+String(d.getFullYear()).slice(-2));
      }
      users=new Array(labels.length).fill(0);
      caps=new Array(labels.length).fill(0);
    }
    if(!Array.isArray(users)) users=[];
    if(!Array.isArray(caps)) caps=[];
    if(users.length<labels.length){users=labels.map(function(_,i){return users[i]||0;});}
    if(caps.length<labels.length){caps=labels.map(function(_,i){return caps[i]||0;});}

    D12={L:labels,u:users,c:caps};
    D7={L:labels.slice(-7),u:users.slice(-7),c:caps.slice(-7)};

    var dayLabels=dash.growthDay&&dash.growthDay.labels||[];
    var dayUsers=dash.growthDay&&dash.growthDay.users||[];
    var dayCaps=dash.growthDay&&dash.growthDay.capsules||[];
    if(!Array.isArray(dayLabels) || !dayLabels.length){
      dayLabels=[];
      var nowDay=new Date();
      for(var di=6;di>=0;di--){
        var dd=new Date(nowDay.getFullYear(),nowDay.getMonth(),nowDay.getDate()-di);
        dayLabels.push(dd.toLocaleDateString('ru-RU',{day:'2-digit',month:'short'}));
      }
      dayUsers=new Array(dayLabels.length).fill(0);
      dayCaps=new Array(dayLabels.length).fill(0);
    }
    if(!Array.isArray(dayUsers)) dayUsers=[];
    if(!Array.isArray(dayCaps)) dayCaps=[];
    if(dayUsers.length<dayLabels.length){dayUsers=dayLabels.map(function(_,i){return dayUsers[i]||0;});}
    if(dayCaps.length<dayLabels.length){dayCaps=dayLabels.map(function(_,i){return dayCaps[i]||0;});}
    D7D={L:dayLabels,u:dayUsers,c:dayCaps};

    safeCall(function(){applySummary(dash.summary||{},dash);});
    safeCall(function(){renderCountries(dash.countries||[]);});
    safeCall(function(){renderRegions(dash.mapPoints||[]);});
    safeCall(function(){renderActivity(dash.activity||[],'activityFeed',5);});
    safeCall(function(){renderActivity(dash.activity||[],'activityFeedAll',20);});
    safeCall(function(){renderUsers(dash.usersList||[]);});
    safeCall(function(){renderCapsules(dash.capsulesList||[]);});
    safeCall(function(){renderReviews(dash.reviews||{});});
    safeCall(function(){renderReviewSummary(dash.reviews||{});});
    safeCall(function(){renderPromoList(dash.promoCodes||[]);});
    safeCall(function(){renderNotifications(dash.activity||[]);});
    safeCall(function(){renderAiLog(dash.ai&&dash.ai.logs||[]);});
    safeCall(function(){applyAiSummary(dash.ai||{});});
    safeCall(function(){applyProfileData(dash.adminProfile||{},true);});
    safeCall(function(){applySettingsData(dash.adminSettings||{},true);});

    ensureChart().then(function(){
      safeCall(function(){updateDonut(dash.capsulesByType||{});});
      var sel=document.getElementById('lineSelect');
      var v=sel&&sel.value;
      var initial=(v==='12')?D12:(v==='7d')?D7D:D7;
      safeCall(function(){buildLine(initial);});
      setTimeout(function(){safeCall(function(){buildLine(initial);});},200);
      safeCall(function(){buildActChart(dash.activityByHour||[]);});
      safeCall(function(){buildAnalytics(dash,0);});
      safeCall(function(){buildAiCharts(dash.ai||{});});
    });

    scheduleDashboardCharts();
    scheduleAnalyticsCharts();

    var promos=Array.isArray(dash.promoCodes)?dash.promoCodes:[];
    var promoTotal=promos.length;
    var promoUsed=promos.filter(function(p){return p.usedBy;}).length;
    var promoDisabled=promos.filter(function(p){return p.disabledAt;}).length;
    setStat('promoTotal',fmtNum(promoTotal));
    setStat('promoUsed',fmtNum(promoUsed));
    setStat('promoDisabled',fmtNum(promoDisabled));
    setStat('unusedPromoCodes',fmtNum(promoTotal));

    window.MAP_POINTS=(dash.mapPoints||[]).map(function(p,i){

      var col=['#C9A84C','#4F87F5','#1FC99A','#9270EF','#E85050'][i%5];

      return {lat:p.lat,lng:p.lng,city:p.city,count:p.count,col:col};

    });

    repairMojibakeInDom(document.body);
    DASH_LOAD_ATTEMPTS=0;
    showDashError('');

  }catch(e){
    console.error('dashboard',e);
    var msg=(e&&e.message)?e.message:'Не удалось загрузить данные админ-панели';
    showDashError('Ошибка загрузки данных: '+msg);
    DASH_LOAD_ATTEMPTS++;
    if(DASH_LOAD_ATTEMPTS<=5){
      setTimeout(loadDashboard,Math.min(8000,1000*DASH_LOAD_ATTEMPTS));
    }
  }

}



async function generatePromoAdmin(duration){
  var out=document.getElementById('promoOut');
  var meta=document.getElementById('promoOutMeta');
  var btnM=document.getElementById('promoMonthBtn');
  var btnY=document.getElementById('promoYearBtn');
  if(btnM)btnM.style.pointerEvents='none';
  if(btnY)btnY.style.pointerEvents='none';
  try{
    var data=await apiAdmin('/api/admin/promo/generate',{method:'POST',body:JSON.stringify({duration:duration})});
    if(out)out.value=(data.promo&&data.promo.code)||'';
    if(meta)meta.textContent=(data.promo&&data.promo.durationLabel)?('Создано на: '+data.promo.durationLabel):'Промокод создан';
    await loadDashboard();
  }catch(e){
    if(meta)meta.textContent='Ошибка: '+(e.message||'не удалось создать промокод');
  }finally{
    if(btnM)btnM.style.pointerEvents='';
    if(btnY)btnY.style.pointerEvents='';
  }
}

async function disablePromoAdmin(){
  var input=document.getElementById('promoDisableInput');
  var meta=document.getElementById('promoDisableMeta');
  var btn=document.getElementById('promoDisableBtn');
  var code=(input&&input.value||'').trim();
  if(!code){if(meta)meta.textContent='Введите код';return;}
  if(btn)btn.style.pointerEvents='none';
  try{
    var res=await apiAdmin('/api/admin/promo/disable',{method:'POST',body:JSON.stringify({code:code})});
    if(meta)meta.textContent=res.alreadyDisabled?'Промокод уже отключён':'Промокод отключён';
    if(input)input.value='';
    await loadDashboard();
  }catch(e){
    if(meta)meta.textContent='Ошибка: '+(e.message||'не удалось отключить');
  }finally{
    if(btn)btn.style.pointerEvents='';
  }
}

function copyPromoOut(){
  var out=document.getElementById('promoOut');
  if(!out||!out.value)return;
  try{
    navigator.clipboard.writeText(out.value);
    var meta=document.getElementById('promoOutMeta');
    if(meta)meta.textContent='Скопировано: '+out.value;
  }catch(e){}
}







