// ============================
// 🔒 Autenticação simples
// ============================
const senhaCorreta = "emr2025";
const senha = prompt("Digite a senha de administrador:");
if (senha !== senhaCorreta) {
  alert("Acesso negado.");
  window.location.href = "index.html";
  throw new Error("Acesso negado");
}

// ============================
// 🔥 Firebase
// ============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  getDocs,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

// Configuração Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC2l8LU3vYfQjTly8JSa658mfIlVk2Dw8E",
  authDomain: "inovacao-emr.firebaseapp.com",
  projectId: "inovacao-emr",
  storageBucket: "inovacao-emr.appspot.com",
  messagingSenderId: "1075399271811",
  appId: "1:1075399271811:web:f532f25547125d6a8f42b6"
};

// Inicialização
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// ============================
// ⚙️ Referências DOM
// ============================
const sections = document.querySelectorAll(".section");
const navItems = document.querySelectorAll(".nav-item[data-target]");
const toastContainer = document.getElementById("toastContainer");

const nomeQuiz = document.getElementById("nomeQuiz");
const corPrincipal = document.getElementById("corPrincipal");
const logoFile = document.getElementById("logoFile");
const logoPreview = document.getElementById("logoPreview");
const tituloInicial = document.getElementById("tituloInicial");
const subtituloInicial = document.getElementById("subtituloInicial");
const tempoPorPergunta = document.getElementById("tempoPorPergunta");
const pontosPorAcerto = document.getElementById("pontosPorAcerto");
const saveConfigBtn = document.getElementById("saveConfig");

const container = document.getElementById("questionsContainer");
const addQuestionBtn = document.getElementById("addQuestion");
const saveAllBtn = document.getElementById("saveAll");

// ============================
// 🚀 Funções auxiliares
// ============================
function showToast(msg) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = msg;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function clearElement(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

// ============================
// 🧭 Navegação entre seções
// ============================
navItems.forEach(item => {
  item.addEventListener("click", () => {
    navItems.forEach(i => i.classList.remove("active"));
    item.classList.add("active");
    sections.forEach(sec => sec.classList.remove("active"));
    document.getElementById(`section-${item.dataset.target}`).classList.add("active");
  });
});

document.getElementById("viewQuiz").onclick = () => window.open("quiz.html", "_blank");
document.getElementById("logout").onclick = () => (window.location.href = "index.html");

// ============================
// ⚙️ CONFIGURAÇÕES
// ============================
async function loadConfig() {
  const refCfg = doc(db, "config", "quizSettings");
  const snap = await getDoc(refCfg);
  if (snap.exists()) {
    const cfg = snap.data();
    nomeQuiz.value = cfg.nomeQuiz || "";
    corPrincipal.value = cfg.corPrincipal || "#009BC1";
    tituloInicial.value = cfg.tituloInicial || "";
    subtituloInicial.value = cfg.subtituloInicial || "";
    tempoPorPergunta.value = cfg.tempoPorPergunta ?? 20;
    pontosPorAcerto.value = cfg.pontosPorAcerto ?? 1000;
    if (cfg.logoURL) logoPreview.src = cfg.logoURL;
  }
}

saveConfigBtn.onclick = async () => {
  await setDoc(doc(db, "config", "quizSettings"), {
    nomeQuiz: nomeQuiz.value,
    corPrincipal: corPrincipal.value,
    tituloInicial: tituloInicial.value,
    subtituloInicial: subtituloInicial.value,
    tempoPorPergunta: Number(tempoPorPergunta.value),
    pontosPorAcerto: Number(pontosPorAcerto.value)
  }, { merge: true });
  showToast("Configurações salvas!");
};

// Upload da logo
logoFile.addEventListener("change", async () => {
  const file = logoFile.files[0];
  if (!file) return;
  const fileRef = ref(storage, `logos/${file.name}`);
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);
  logoPreview.src = url;
  await setDoc(doc(db, "config", "quizSettings"), { logoURL: url }, { merge: true });
  showToast("Logo atualizada!");
});

// Sincronização em tempo real das configurações
onSnapshot(doc(db, "config", "quizSettings"), (snap) => {
  if (snap.exists()) {
    const cfg = snap.data();
    nomeQuiz.value = cfg.nomeQuiz || "";
    corPrincipal.value = cfg.corPrincipal || "#009BC1";
    tituloInicial.value = cfg.tituloInicial || "";
    subtituloInicial.value = cfg.subtituloInicial || "";
    tempoPorPergunta.value = cfg.tempoPorPergunta ?? 20;
    pontosPorAcerto.value = cfg.pontosPorAcerto ?? 1000;
    if (cfg.logoURL) logoPreview.src = cfg.logoURL;
  }
});

// ============================
// ❓ PERGUNTAS
// ============================
function createOption(optList, qid, text = "", isCorrect = false) {
  const optDiv = document.createElement("div");
  optDiv.className = "option-item";

  const radio = document.createElement("input");
  radio.type = "radio";
  radio.name = qid;
  radio.checked = isCorrect;
  radio.addEventListener("change", () => {
    optList.querySelectorAll(".option-item").forEach(el => el.classList.remove("correct"));
    optDiv.classList.add("correct");
  });

  const textInput = document.createElement("input");
  textInput.type = "text";
  textInput.className = "opt-text";
  textInput.value = text;
  textInput.placeholder = "Digite a alternativa";

  const delBtn = document.createElement("button");
  delBtn.className = "remove-opt";
  delBtn.innerHTML = "🗑️";
  delBtn.onclick = () => optDiv.remove();

  optDiv.appendChild(radio);
  optDiv.appendChild(textInput);
  optDiv.appendChild(delBtn);
  optList.appendChild(optDiv);

  if (isCorrect) optDiv.classList.add("correct");
}

function createQuestionCard(q = { title: "", options: ["", ""], answerIndex: -1 }) {
  const card = document.createElement("div");
  card.className = "question-card";

  const qid = "q_" + Math.random().toString(36).substr(2, 9);

  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.placeholder = "Digite a pergunta";
  titleInput.value = q.title;

  const optList = document.createElement("div");
  optList.className = "options-list";

  q.options.forEach((o, i) => createOption(optList, qid, o, i === q.answerIndex));

  const addOptBtn = document.createElement("button");
  addOptBtn.className = "btn-add";
  addOptBtn.textContent = "+ Adicionar alternativa";
  addOptBtn.onclick = () => createOption(optList, qid);

  const delQBtn = document.createElement("button");
  delQBtn.className = "remove-opt";
  delQBtn.textContent = "Excluir pergunta";
  delQBtn.onclick = async () => {
    if (confirm("Excluir esta pergunta?")) {
      await deleteDoc(doc(db, "questions", q.title.toLowerCase().replace(/\s+/g, "-")));
      showToast("Pergunta excluída!");
      card.remove();
    }
  };

  const bottom = document.createElement("div");
  bottom.className = "actions";
  bottom.appendChild(addOptBtn);
  bottom.appendChild(delQBtn);

  card.appendChild(titleInput);
  card.appendChild(optList);
  card.appendChild(bottom);
  container.appendChild(card);
}

async function saveAllQuestions() {
  const cards = container.querySelectorAll(".question-card");
  for (const card of cards) {
    const title = card.querySelector("input[type='text']").value.trim();
    const opts = [...card.querySelectorAll(".opt-text")].map(o => o.value.trim());
    const correctIndex = [...card.querySelectorAll("input[type='radio']")].findIndex(r => r.checked);
    if (!title || opts.length < 2 || correctIndex === -1) continue;
    await setDoc(doc(db, "questions", title.toLowerCase().replace(/\s+/g, "-")), {
      title,
      options: opts,
      answerIndex: correctIndex
    });
  }
  showToast("Perguntas salvas!");
}

addQuestionBtn.onclick = () => createQuestionCard();
saveAllBtn.onclick = saveAllQuestions;

// Sincronização em tempo real das perguntas
onSnapshot(collection(db, "questions"), (snapshot) => {
  clearElement(container);
  snapshot.forEach(docSnap => {
    createQuestionCard(docSnap.data());
  });
});

// ============================
// 🚀 Inicialização
// ============================
(async () => {
  await loadConfig();
  const snap = await getDocs(collection(db, "questions"));
  snap.forEach(docSnap => createQuestionCard(docSnap.data()));
})();
