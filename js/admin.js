import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* === Firebase Config === */
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
const db = getFirestore(app);

/* === Referências === */
const $ = (sel) => document.querySelector(sel);
const preview = $("#colorPreview");
const toast = $("#toast");

/* === Atualiza o preview === */
function updatePreview() {
  const primary = $("#primaryColor").value;
  const secondary = $("#secondaryColor").value;
  const style = $("#backgroundStyle").value;
  const dir = $("#gradientDirection").value;

  if (style === "gradient") {
    preview.style.background = `linear-gradient(${dir}, ${primary}, ${secondary})`;
  } else {
    preview.style.background = primary;
  }
}

/* === Mostrar toast === */
function showToast(msg = "Alterações salvas com sucesso ✅") {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

/* === Carregar configurações === */
async function loadData() {
  const aSnap = await getDoc(doc(db, "config", "appearance"));
  const appearance = aSnap.exists() ? aSnap.data() : {};

  $("#quizTitle").value = appearance.quizTitle || "Quiz EMR";
  $("#primaryColor").value = appearance.primaryColor || "#009BC1";
  $("#secondaryColor").value = appearance.secondaryColor || "#ff6fae";
  $("#backgroundStyle").value = appearance.backgroundStyle || "gradient";
  $("#gradientDirection").value = appearance.gradientDirection || "135deg";

  updatePreview();
}

/* === Salvar configurações === */
async function saveAll() {
  const appearance = {
    quizTitle: $("#quizTitle").value,
    primaryColor: $("#primaryColor").value,
    secondaryColor: $("#secondaryColor").value,
    backgroundStyle: $("#backgroundStyle").value,
    gradientDirection: $("#gradientDirection").value
  };

  await setDoc(doc(db, "config", "appearance"), appearance);
  showToast();
}

/* === Eventos === */
["#primaryColor", "#secondaryColor", "#backgroundStyle", "#gradientDirection"].forEach((id) => {
  $(id).addEventListener("input", updatePreview);
});

$("#saveBtn").addEventListener("click", saveAll);
$("#logoutBtn").addEventListener("click", () => (window.location.href = "index.html"));

/* === Inicialização === */
loadData();
