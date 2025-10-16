import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { 
  getFirestore, collection, getDocs, setDoc, doc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC2l8LU3vYfQjTly8JSa658mfIlVk2Dw8E",
  authDomain: "inovacao-emr.firebaseapp.com",
  projectId: "inovacao-emr",
  storageBucket: "inovacao-emr.firebasestorage.app",
  messagingSenderId: "1075399271811",
  appId: "1:1075399271811:web:f532f25547125d6a8f42b6",
  measurementId: "G-8CTLMNCZJN"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

const container = document.getElementById('questions');
const addBtn = document.getElementById('addQ');
const saveBtn = document.getElementById('saveAll');
const resetBtn = document.getElementById('resetRank');

async function loadQuestions(){
  const snap = await getDocs(collection(db, "questions"));
  return snap.docs.map(d => ({ id:d.id, ...d.data() }));
}

function render(questions){
  container.innerHTML = "";
  questions.forEach((q)=>{
    const div=document.createElement('div');
    div.className="question";
    div.innerHTML=`
      <input type="text" value="${q.title||''}" placeholder="Título da pergunta">
      <textarea placeholder="Opções (uma por linha)">${(q.options||[]).join('\n')}</textarea>
      <input type="number" min="0" value="${q.answerIndex??0}" placeholder="Índice da resposta correta">
      <button class="delete">Excluir</button>
    `;
    div.querySelector('.delete').onclick=()=>{ div.remove(); };
    container.appendChild(div);
  });
}

addBtn.onclick=()=>{
  const q={title:"",options:[""],answerIndex:0};
  const div=document.createElement('div');
  div.className="question";
  div.innerHTML=`
    <input type="text" placeholder="Título da pergunta">
    <textarea placeholder="Opções (uma por linha)"></textarea>
    <input type="number" min="0" value="0" placeholder="Índice da resposta correta">
    <button class="delete">Excluir</button>
  `;
  div.querySelector('.delete').onclick=()=>{ div.remove(); };
  container.appendChild(div);
};

saveBtn.onclick=async()=>{
  const blocks=[...container.querySelectorAll('.question')];
  for(const [i,div] of blocks.entries()){
    const title=div.querySelector('input[type=text]').value.trim();
    const opts=div.querySelector('textarea').value.split('\n').map(s=>s.trim()).filter(Boolean);
    const ans=Number(div.querySelector('input[type=number]').value);
    if(!title||!opts.length){ alert(`Pergunta ${i+1} inválida`); return; }
    const ref=doc(db,"questions",title.toLowerCase().replace(/\s+/g,'-'));
    await setDoc(ref,{title,options:opts,answerIndex:ans});
  }
  alert("Perguntas salvas com sucesso!");
  location.reload();
};

resetBtn.onclick=async()=>{
  if(!confirm("Deseja realmente limpar o ranking?")) return;
  const snap = await getDocs(collection(db,"scores"));
  for(const d of snap.docs){ await deleteDoc(doc(db,"scores",d.id)); }
  alert("Ranking resetado!");
};

(async()=>{
  const data=await loadQuestions();
  render(data);
})();
