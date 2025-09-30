export const QUESTIONS = [
  {
    title: "O que significa NPS?",
    options: ["Net Product Score", "Net Promoter Score", "New Project Scale", "Network Performance Stat"],
    answerIndex: 1
  },
  {
    title: "Qual linguagem é usada no Power Apps para fórmulas?",
    options: ["DAX", "M", "Power Fx", "Python"],
    answerIndex: 2
  },
  {
    title: "Qual destes é um serviço do Microsoft 365?",
    options: ["Gmail", "SharePoint", "Firebase", "Figma"],
    answerIndex: 1
  },
  {
    title: "Qual medida favorece respostas rápidas?",
    options: ["Somente acerto conta", "Tempo não importa", "Bônus por velocidade", "Penalidade por responder"],
    answerIndex: 2
  },
  {
    title: "Para hospedar site estático grátis no GitHub você usa:",
    options: ["GitHub Pages", "EC2", "IIS", "Nginx pago"],
    answerIndex: 0
  }
];

// Pontuação: 1000 por acerto + bônus por velocidade (até 500)
export function computeScore(correct, elapsedSeconds) {
  if (!correct) return 0;
  const bonus = Math.max(0, 500 - Math.floor((elapsedSeconds * 1000) / 100)); // -1 por 100ms
  return 1000 + bonus;
}
