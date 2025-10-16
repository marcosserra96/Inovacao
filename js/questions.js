export const QUESTIONS = [
  {
    title: "Ao ver um cabo caído na rua após uma tempestade, o que você deve fazer?",
    options: [
      "Tentar afastá-lo com um galho seco",
      "Jogar areia ou pano em cima",
      "Se afastar imediatamente e avisar a concessionária de energia",
      "Fotografar de perto para registrar o problema"
    ],
    answerIndex: 2
  },
  {
    title: "Você está soltando pipa com seus amigos e ela enrosca em um fio da rede elétrica. O que você deve fazer?",
    options: [
      "Puxar com cuidado usando uma linha seca",
      "Subir em um muro para tentar alcançar a pipa",
      "Parar imediatamente e se afastar, avisando um adulto para que o mesmo acione concessionária de energia",
      "Tentar tirar com um cabo de vassoura"
    ],
    answerIndex: 2
  },
  {
    title: "Qual dessas atitudes demonstra comportamento seguro próximo à rede elétrica?",
    options: [
      "Fazer manutenção em telhado sem verificar a distância dos fios",
      "Planejar a atividade, manter distância da rede e usar EPIs adequados",
      "Subir em árvores próximas aos cabos para podar galhos",
      "Usar escadas metálicas próximas aos fios"
    ],
    answerIndex: 1
  },
  {
    title: "Qual é a forma mais segura de transportar vergalhões, antenas ou canos próximos a postes?",
    options: [
      "Na posição vertical",
      "Na posição horizontal, longe dos fios",
      "De qualquer forma, se estiver seco",
    ],
    answerIndex: 1
  },
  {
    title: "Qual é o nome do programa de inovação da Energisa?",
    options: [
      "Inova+",
      "Transforma",
      "e-Nova",
      "Inspira"
    ],
    answerIndex: 2
  },
  {
    title: "Durante a pintura de uma fachada próxima a um poste, qual é o principal cuidado que o pintor deve ter?",
    options: [
      "Escolher tinta de secagem rápida",
      "Manter distância segura dos fios e verificar a proximidade da rede antes de iniciar o trabalho",
      "Trabalhar apenas em dias nublados",
      "Usar luvas de tecido"
    ],
    answerIndex: 1
  },
  {
    title: "Por que a inovação é estratégica para uma distribuidora de energia como a Energisa?",
    options: [
      "Para manter a empresa competitiva, sustentável e preparada para o futuro",
      "Para reduzir o número de clientes atendidos",
      "Para aumentar apenas os lucros de curto prazo",
      "Para substituir completamente as fontes de energia tradicionais"
    ],
    answerIndex: 0
  },
  {
    title: "Por que é perigoso podar ou subir em árvores que estão próximas da rede elétrica?",
    options: [
      "Porque pode sujar as ferramentas",
      "Porque os galhos e o corpo podem encostar ou se aproximar da fiação, causando choque elétrico — além disso, a poda e a manutenção dessas árvores são de responsabilidade da prefeitura, que deve acionar a concessionária quando houver risco próximo à rede elétrica.",
      "Porque atrapalha os pássaros",
      "Porque a árvore pode cair"
    ],
    answerIndex: 1
  }
];

// Função de pontuação baseada em acerto e tempo
export function computeScore(correct, usedTime) {
  if (!correct) return 0;
  const maxTime = 20; // mesmo limite do quiz
  const factor = Math.max(0.2, 1 - usedTime / maxTime);
  return Math.round(1000 * factor);
}
