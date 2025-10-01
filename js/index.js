import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 🔑 Seu config do Firebase aqui
import { firebaseConfig } from "./config.js";

// Init
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Ranking em tempo real (top 10)
const rows = document.getElementById("ranking-rows");
const baseQ = query(collection(db,"scores"), orderBy("score","desc"), limit(10));

onSnapshot(baseQ,(snap)=>{
  const data = snap.docs.map(d=>d.data());
  renderData(data);
});

function renderData(data){
  rows.innerHTML="";
  if(!data.length){
    rows.innerHTML=`<tr><td colspan="4" class="muted" style="padding:14px;">Sem resultados ainda.</td></tr>`;
    return;
  }
  let pos=1;
  data.slice(0,10).forEach(d=>{
    let medal=pos;
    if(pos===1) medal="🏆"; else if(pos===2) medal="🥈"; else if(pos===3) medal="🥉";
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td>${medal}</td>
      <td>${(d.name||"-").toString().slice(0,48)}</td>
      <td><strong>${d.score ?? 0}</strong></td>
      <td>${Number.isFinite(+d.totalTime)?(+d.totalTime).toFixed(1)+"s":"-"}</td>
    `;
    rows.appendChild(tr);
    pos++;
  });
}
