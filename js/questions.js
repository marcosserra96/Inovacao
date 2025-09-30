export const QUESTIONS = [

  {
    title: "O que significa inovação disruptiva?",
    options: [
      "Melhorias graduais em produtos existentes",
      "Criação de algo totalmente novo que muda o mercado",
      "Redução de custos em processos internos",
      "Adoção de tecnologias digitais em empresas"
    ],
    answerIndex: 1
  },
  {
    title: "Qual destas é considerada uma prática de inovação aberta?",
    options: [
      "Guardar todas as ideias em segredo",
      "Criar soluções apenas dentro da empresa",
      "Colaborar com universidades, startups ou clientes",
      "Investir apenas em equipamentos novos"
    ],
    answerIndex: 2
  },
  {
    title: "Design Thinking é uma metodologia voltada para:",
    options: [
      "Reduzir custos operacionais",
      "Resolução de problemas centrada no ser humano",
      "Planejamento estratégico de marketing",
      "Controle financeiro e orçamentário"
    ],
    answerIndex: 1
  },
  {
    title: "O termo 'Prototipagem Rápida' se refere a:",
    options: [
      "Criar uma versão inicial de uma ideia para testar",
      "Comprar equipamentos mais velozes",
      "Contratar equipes rapidamente",
      "Melhorar a velocidade de um sistema"
    ],
    answerIndex: 0
  },
  {
    title: "Qual tecnologia é considerada essencial para a Indústria 4.0?",
    options: [
      "Máquinas a vapor",
      "Impressão 3D",
      "Papeis e arquivos físicos",
      "Energia a carvão"
    ],
    answerIndex: 1
  },
  {
    title: "Inovação incremental é caracterizada por:",
    options: [
      "Mudanças pequenas e contínuas em produtos/processos",
      "Criação de algo totalmente novo no mercado",
      "Substituição completa de um setor por outro",
      "Uso de IA para automação"
    ],
    answerIndex: 0
  },
  {
    title: "O que é cultura de inovação dentro de uma empresa?",
    options: [
      "Apenas criar laboratórios de pesquisa",
      "Incentivar todos os colaboradores a propor melhorias",
      "Ter um setor exclusivo de P&D",
      "Contratar consultorias externas"
    ],
    answerIndex: 1
  },
  {
    title: "Qual destas tecnologias é exemplo de transformação digital?",
    options: [
      "Uso de planilhas impressas",
      "Chatbots e Inteligência Artificial no atendimento",
      "Máquina de escrever moderna",
      "Fax corporativo"
    ],
    answerIndex: 1
  },
  {
    title: "O que significa 'fail fast, learn fast' no contexto da inovação?",
    options: [
      "Evitar falhas a qualquer custo",
      "Investir pouco em inovação",
      "Errar rápido para aprender e ajustar a solução",
      "Copiar práticas já existentes no mercado"
    ],
    answerIndex: 2
  },
  {
    title: "Hackathons são eventos que têm como objetivo:",
    options: [
      "Encontrar falhas de segurança em sistemas",
      "Criar soluções inovadoras em curto espaço de tempo",
      "Realizar treinamentos obrigatórios",
      "Apresentar relatórios financeiros"
    ],
    answerIndex: 1
  }

];

export function computeScore(correct, elapsedSeconds) {
  if (!correct) return 0;
  const bonus = Math.max(0, 600 - Math.floor((elapsedSeconds * 1000) / 80));
  return 1000 + bonus;
}
