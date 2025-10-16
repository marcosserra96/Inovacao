// ======= Proteção por senha =======
const senhaCorreta = "emr2025";
const senha = prompt("Digite a senha de administrador:");
if (senha !== senhaCorreta) {
  alert("Acesso negado.");
  window.location.href = "index.html";
  throw new Error("Acesso negado");
}
document.getElementById("panel").style.display = "block";

// ======= Firebase =======
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { 
  getFirestore, collection, getDocs, setDoc, doc, deleteDoc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { 
  getStorage, ref, uploadBytes, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyC2l8LU3vYfQjTly8JSa658mfIlVk2Dw8E",
  authDomain: "inovacao-emr.firebaseapp.com",
  projectId: "inovacao-emr",
  storageBucket: "inovacao-emr.appspot.com",
  messagingSenderId: "1075399271811",
  appId: "1:1075399271811:web:f532f25547125d6a8f42b6",
  measurementId: "G-8CTLMNCZJN"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const storage = getStorage(app);

// ======= Referências de elementos =======
const container = document.getElementById('questions');
const addBtn = document.getElementById('addQ');
const saveBtn = document.getElementById('saveAll');
const resetBtn = document.getElementById('resetRank');
const saveConfigBtn = document.getElementById('saveConfig');

const nomeQuiz = document.getElementById('nomeQuiz');
const corPrincipal = document.getElementById('corPrincipal');
const logoFile = document.getElementById('logoFile');
const logoPreview = document.getElementById('logoPreview');
const tituloInicial = document.getElementById('tituloInicial');
const subtituloInicial = document.getElementById('subtituloInicial');
const tempoInput = document.getElementById('tempoPorPergunta');
const pontosInput = document.getElementById('pontosPorAcerto');

// ======= Carregar Configurações =======
async function loadConfig(){
  const ref = doc(db, "config", "quizSettings");
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const cfg = snap.data();
    nomeQuiz.value = cfg.nomeQuiz || "";
    corPrincipal.value = cfg.corPrincipal || "#009BC1";
    tituloInicial.value = cfg.tituloInicial || "";
    subtituloInicial.value = cfg.subtituloInicial || "";
    tempoInput.value = cfg.tempoPorPergunta ?? 20;
    pontosInput.value = cfg.pontosPorAcerto ?? 1000;
    if(cfg.logoURL){ logoPreview.src = cfg.logoURL; }
  }
}

// ======= Salvar Configurações =======
saveConfigBtn.onclick = async ()=>{
  const ref = doc(db, "config", "quizSettings");
  await setDoc(ref, {
    nomeQuiz: nomeQuiz.value,
    corPrincipal: corPrincipal.value,
    tituloInicial: tituloInicial.value,
    subtituloInicial: subtituloInicial.value,
    tempoPorPergunta: Number(tempoInput.value),
    pontosPorAcerto: Number(pontosInput.value)
  }, { merge: true });
  alert("Configurações salvas!");
};

// ======= Upload da logo =======
logoFile.addEventListener("change", async ()=>{
  const file = logoFile.files[0];
  if (!file) return;

  const fileRef = ref(storage, `logos/${file.name}`);
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);
  logoPreview.src = url;

  const refCfg = doc(db, "config", "quizSettings");
  await setDoc(refCfg, { logoURL: url }, { merge: true });
  alert("Logo atualizada com sucesso!");
});

// ======= Perguntas =======
async function loadQuestions(){
  const snap = await getDocs(collection(db, "questions"));
  return snap.docs.map(d => ({ id:d.id, ...d.data() }));
}

// Renderização dinâmica de perguntas
function render(questions){
  container.innerHTML = "";
  questions.forEach((q)=>{
    const div=document.createElement('div');
    div.className="question";
    div.innerHTML=`
      <input type="text" class="q-title" placeholder="Título da pergunta" value="${q.title||''}">
      <div class="options-list"></div>
      <button class="add-option">+ Adicionar opção</button>
      <button class="delete">Excluir Pergunta</button>
    `;

    const optList = div.querySelector(".options-list");
    const addOptBtn = div.querySelector(".add-option");

    // Função para criar campo de opção
    function createOption(text="", index=0, isCorrect=false){
      const optDiv=document.createElement('div');
      optDiv.className="option-item";
      optDiv.innerHTML=`
        <input type="radio" name="correct-${q.title||Math.random()}" ${isCorrect?"checked":""} class="opt-correct">
        <input type="text" class="opt-text" value="${text}" placeholder="Texto da opção">
        <button class="remove-opt" style="margin-left:8px;">🗑</button>
      `;
      optDiv.querySelector(".remove-opt").onclick=()=>optDiv.remove();
      optList.appendChild(optDiv);
    }

    // Renderiza as opções existentes
    (q.options||[]).forEach((opt,i)=>createOption(opt,i,i===q.answerIndex));

    // Adiciona nova opção
    addOptBtn.onclick=()=>createOption();

    // Excluir pergunta
    div.querySelector(".delete").onclick=()=>div.remove();

    container.appendChild(div);
  });
}

// ======= Salvar Perguntas =======
saveBtn.onclick=async()=>{
  const blocks=[...container.querySelectorAll('.question')];

  for(const [i,div] of blocks.entries()){
    const title=div.querySelector('.q-title').value.trim();
    if(!title){ alert(`Pergunta ${i+1} sem título`); return; }

    const options=[...div.querySelectorAll('.opt-text')].map(o=>o.value.trim()).filter(Boolean);
    if(options.length<2){ alert(`Pergunta ${i+1} precisa de pelo menos 2 opções`); return; }

    const correctIndex=[...div.querySelectorAll('.opt-correct')].findIndex(o=>o.checked);
    if(correctIndex===-1){ alert(`Selecione a resposta correta da pergunta ${i+1}`); return; }

    const ref=doc(db,"questions",title.toLowerCase().replace(/\s+/g,'-'));
    await setDoc(ref,{title,options,answerIndex:correctIndex});
  }

  alert("Perguntas salvas com sucesso!");
  location.reload();
};

// ======= Resetar Ranking =======
resetBtn.onclick=async()=>{
  if(!confirm("Deseja realmente limpar o ranking?")) return;
  const snap = await getDocs(collection(db,"scores"));
  for(const d of snap.docs){ await deleteDoc(doc(db,"scores",d.id)); }
  alert("Ranking resetado!");
};

// ======= Inicialização =======
(async()=>{
  await loadConfig();
  const data=await loadQuestions();
  render(data);
})();
