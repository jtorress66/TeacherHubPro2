import type { DemoMessages } from './marketing-types.ts';

// The product tour on /demo, in Brazilian Portuguese.
export const demoPt: DemoMessages = {
  demo: {
    metaTitle: 'Demonstração do TeacherHubPro: veja cada recurso, passo a passo',
    metaDescription:
      'Um tour guiado pelo TeacherHubPro com telas reais: planos de aula, frequência, correção com IA, jogos, jogos ao vivo, portais da família e muito mais.',
    title: 'Conheça o TeacherHubPro, passo a passo',
    intro:
      'Um tour guiado por todo o aplicativo em {steps} passos, com telas reais. Todos os alunos que você vai ver são fictícios.',
    contents: 'Capítulos',
    chapterNumber: 'Capítulo {n}',
    enlarge: 'Abrir a captura de tela em tamanho real: {title}',
    madeUp:
      'Todos os nomes, turmas e notas destas capturas são fictícios. Os rascunhos de IA foram escritos pela IA do aplicativo e aparecem exatamente como ela os escreveu.',
    chapters: {
      start: {
        title: 'Primeiros passos',
        intro: 'Cadastre-se em um minuto e comece com uma turma de exemplo já pronta.',
      },
      classes: {
        title: 'Turmas, listas de alunos e frequência',
        intro: 'Traga seus alunos de uma planilha e registre a frequência em segundos.',
      },
      planning: {
        title: 'Planejamento de aulas',
        intro:
          'Planos semanais alinhados ao Common Core e aos padrões de Porto Rico, prontos para imprimir.',
      },
      assistant: {
        title: 'Assistente de IA',
        intro:
          'Fichas, quizzes e rubricas criados para a sua série e o seu tema. Você edita e decide.',
      },
      presentations: {
        title: 'Apresentações',
        intro:
          'Slides criados pela IA, prontos para apresentar ou abrir no Google Slides, no Canva ou no OneDrive.',
      },
      prep: {
        title: 'Agente de preparação',
        intro: 'Uma frase vira uma semana inteira, e você revisa tudo antes de qualquer envio.',
      },
      assignments: {
        title: 'Tarefas e correção com IA',
        intro:
          'Transforme um PDF em uma tarefa online, compartilhe com um link e confirme as notas sugeridas pela IA.',
      },
      gradebook: {
        title: 'Diário de notas e boletins',
        intro: 'Categorias com pesos, semestres e boletins, a partir das notas que você confirmou.',
      },
      games: {
        title: 'Jogos educativos',
        intro:
          'Onze modos de jogo, com uma explicação para cada resposta e acompanhamento dos padrões.',
      },
      live: {
        title: 'Jogos ao vivo em sala',
        intro: 'Joguem juntos no telão enquanto os alunos respondem pelo celular.',
      },
      learning: {
        title: 'Aprendizagem adaptativa e análises dos alunos',
        intro:
          'Trilhas de aprendizagem personalizadas e sinais precoces de quem pode precisar de ajuda.',
      },
      families: {
        title: 'Portal da família',
        intro: 'As famílias veem notas e frequência por um link privado, sem precisar de conta.',
      },
      substitutes: {
        title: 'Pacotes para substituto',
        intro: 'Tudo o que um professor substituto precisa, impresso com um clique.',
      },
      connections: {
        title: 'Ferramentas conectadas',
        intro: 'Funciona com Google, Microsoft, Canva e o sistema de cursos da sua escola.',
      },
      schools: {
        title: 'Para escolas e redes de ensino',
        intro:
          'Uso, controles, um registro das decisões da IA e os seus dados, tudo em um só lugar.',
      },
    },
    steps: {
      signup: {
        title: 'Crie sua conta',
        text: 'Cadastre-se com seu e-mail ou sua conta Google. Seu teste grátis começa na hora, sem cartão.',
        alt: 'A página de cadastro do TeacherHubPro com os campos de nome, e-mail e senha.',
      },
      commandCenter: {
        title: 'Sua Central de Comando',
        text: 'Toda manhã você vê as turmas de hoje, os trabalhos aguardando correção e os alunos que podem precisar de ajuda, tudo em uma só tela.',
        alt: 'A Central de Comando com as turmas de hoje, os trabalhos para corrigir e um aluno que pode precisar de ajuda.',
      },
      sampleClass: {
        title: 'Experimente com uma turma de exemplo',
        text: 'Com um clique, é adicionada uma turma de exemplo com alunos, notas e frequência fictícios, para você experimentar tudo antes de adicionar os seus. Remova-a quando quiser.',
        alt: 'A página da turma de exemplo com seis alunos fictícios.',
      },
      rosterImport: {
        title: 'Importe sua lista de alunos',
        text: 'Envie uma planilha com nomes e sobrenomes. Número do aluno, e-mail dos responsáveis, adaptações e idioma da família são colunas opcionais.',
        alt: 'A lista de uma turma depois de importar os alunos de uma planilha.',
      },
      accommodations: {
        title: 'Adaptações em um só lugar',
        text: 'Anote uma única vez as adaptações de cada aluno. Elas aparecem onde importam, como no pacote para substituto, e ficam restritas a você e à sua escola.',
        alt: 'O formulário de um aluno com o campo de adaptações preenchido.',
      },
      attendance: {
        title: 'Registre a frequência em segundos',
        text: 'Marque presente, ausente, atrasado ou justificado para cada aluno, informe os minutos de atraso e salve o dia.',
        alt: 'A folha de frequência com uma situação para cada aluno.',
      },
      attendanceReport: {
        title: 'A frequência num relance',
        text: 'O relatório de frequência mostra a taxa de cada aluno e todas as faltas e atrasos nas datas que você escolher.',
        alt: 'O relatório de frequência com a taxa de frequência de cada aluno.',
      },
      planner: {
        title: 'Planeje sua semana com os padrões',
        text: 'Escreva seu plano semanal dia a dia e escolha padrões das listas oficiais do Common Core e de Porto Rico. O aplicativo nunca inventa um código de padrão.',
        alt: 'O planejador semanal com o seletor de padrões de Porto Rico aberto.',
      },
      planPrint: {
        title: 'Imprima no formato da sua escola',
        text: 'Imprima os planos no formato clássico, com o cabeçalho da sua escola, ou em um formato simples de uma página.',
        alt: 'Um plano semanal pronto para imprimir no formato clássico.',
      },
      curriculum: {
        title: 'Adicione seus guias curriculares',
        text: 'Envie ou cole os guias de sequência da sua escola. A IA os segue ao criar planos, para que os rascunhos correspondam ao que sua escola ensina.',
        alt: 'A página de guias curriculares com um guia de sequência pronto para usar.',
      },
      templates: {
        title: 'Comece por um modelo',
        text: 'Comece um plano a partir de uma unidade pronta ou de uma sua, e depois mude o que quiser.',
        alt: 'A página de modelos com unidades prontas.',
      },
      assistantForm: {
        title: 'Peça ao assistente de IA',
        text: 'Escolha uma ficha, um quiz ou um plano de aula e, em seguida, a disciplina, a série, o tema e o idioma. Marque Apoio ESL para ter material no nível dos alunos que aprendem inglês, seguindo WIDA e os padrões de Porto Rico.',
        alt: 'O formulário do assistente de IA com tipo, tema, série e Apoio ESL.',
      },
      assistantResult: {
        title: 'Revise o rascunho',
        text: 'O rascunho fica pronto em segundos. Copie, imprima, ouça em voz alta, abra no Canva ou salve no OneDrive.',
        alt: 'Uma ficha criada pelo assistente de IA.',
      },
      rubric: {
        title: 'Crie rubricas',
        text: 'Comece uma rubrica do zero ou peça um rascunho à IA, e depois edite cada critério e nível. Use-a para corrigir respostas escritas.',
        alt: 'Uma rubrica com critérios e níveis, pronta para editar.',
      },
      presentation: {
        title: 'Crie uma apresentação',
        text: 'Informe um tema e o número de slides, escolha um visual e edite cada slide antes de apresentar.',
        alt: 'Uma apresentação criada pela IA, aberta no editor de slides.',
      },
      presentationExport: {
        title: 'Apresente onde quiser',
        text: 'Apresente pelo navegador, baixe em PowerPoint, envie para o Google Classroom e o Slides, abra no Canva ou salve no OneDrive.',
        alt: 'As opções de uma apresentação para enviá-la ao Google Classroom, ao Canva e ao OneDrive.',
      },
      prepStart: {
        title: 'Uma frase, uma semana inteira',
        text: 'Digite o que você vai ensinar nesta semana. O Agente de preparação cria o plano, os slides e as fichas de cada dia, um quiz de sexta-feira e um recado para as famílias.',
        alt: 'O formulário do Agente de preparação com uma frase descrevendo a semana.',
      },
      prepReview: {
        title: 'Você revisa antes de qualquer envio',
        text: 'Leia cada item, mantenha ou descarte e edite o e-mail para as famílias. Nada é publicado nem enviado até você autorizar.',
        alt: 'A revisão do Agente de preparação com o plano da semana, as fichas, o quiz e o e-mail para as famílias.',
      },
      pdfImport: {
        title: 'Transforme um PDF em uma tarefa online',
        text: 'Envie uma ficha ou uma prova em PDF. A IA leva as questões para um editor onde você confere cada uma antes de salvar.',
        alt: 'Questões importadas de um PDF, prontas para conferir e salvar.',
      },
      studentLinks: {
        title: 'Compartilhe com links dos alunos',
        text: 'Cada aluno recebe um link privado: sem contas nem senhas para gerenciar. Você pode substituir ou desativar um link a qualquer momento.',
        alt: 'A página de links dos alunos com um link para cada aluno.',
      },
      studentAnswer: {
        title: 'Os alunos respondem em qualquer dispositivo',
        text: 'Os alunos abrem o link no celular, no tablet ou no computador, respondem e entregam. As questões podem ser lidas em voz alta.',
        alt: 'Um aluno respondendo a uma tarefa no celular.',
      },
      aiGrading: {
        title: 'A IA sugere, você decide',
        text: 'As questões de múltipla escolha se corrigem sozinhas. Nas respostas escritas, a IA sugere uma nota e um comentário, e nada conta até você confirmar ou alterar.',
        alt: 'A resposta de um aluno com uma nota sugerida pela IA aguardando a confirmação do professor.',
      },
      gradebook: {
        title: 'Um diário de notas que fecha a conta',
        text: 'Categorias com pesos, a nota final de cada aluno e apenas as notas que você confirmou.',
        alt: 'O diário de notas com categorias e a nota final de cada aluno.',
      },
      reportCards: {
        title: 'Boletins em minutos',
        text: 'Adicione um comentário para cada aluno e baixe os boletins em PDF, um por um ou da turma inteira.',
        alt: 'Boletins com notas por categoria e um comentário do professor.',
      },
      gameBuilder: {
        title: 'Crie um jogo em minutos',
        text: 'Escreva suas próprias perguntas ou peça um rascunho à IA, e depois escolha entre onze modos, como Quiz, Contra o relógio, Associação, Jogo da memória e Palavras cruzadas.',
        alt: 'O criador de jogos com cartões de perguntas.',
      },
      gameReview: {
        title: 'Os alunos entendem o porquê',
        text: 'Depois de uma rodada, os alunos veem as perguntas que erraram, com a resposta certa e uma breve explicação do porquê.',
        alt: 'A revisão de um aluno depois de um jogo, com as respostas certas e as explicações.',
      },
      aiExplanations: {
        title: 'Explicações escritas para você',
        text: 'Com um clique, a IA escreve um breve “porquê” para cada cartão que não tem um. Você lê e edita antes de salvar.',
        alt: 'Explicações escritas pela IA, prontas para o professor revisar.',
      },
      coverage: {
        title: 'Veja quais padrões você já cobriu',
        text: 'O relatório de cobertura mostra o desempenho da turma em cada padrão que você marcou, com um clique para retomar o que precisa de reforço.',
        alt: 'O relatório de cobertura de padrões de uma turma.',
      },
      liveLobby: {
        title: 'Inicie um jogo ao vivo',
        text: 'Coloque o jogo no telão. Os alunos entram com um PIN de 6 dígitos e tocam no próprio nome, da sua lista.',
        alt: 'A sala de espera do jogo ao vivo com o PIN e os alunos que entraram.',
      },
      livePlayer: {
        title: 'Os alunos jogam pelo celular',
        text: 'Cada aluno responde no próprio dispositivo, contra o relógio, ganhando pontos por rapidez e por sequências de acertos.',
        alt: 'Um aluno respondendo a uma pergunta de jogo ao vivo no celular.',
      },
      liveReveal: {
        title: 'Revelar, explicar e seguir em frente',
        text: 'Depois de cada pergunta, o telão mostra a resposta certa, como a turma respondeu e por quê, e depois o placar.',
        alt: 'O telão mostrando a resposta certa, as respostas da turma e a explicação.',
      },
      learningPath: {
        title: 'Trilhas de aprendizagem personalizadas',
        text: 'Crie uma breve série de lições para um aluno sobre o tema de que ele precisa. Você edita e depois atribui ao link dele.',
        alt: 'Uma trilha de aprendizagem criada para um aluno, aberta no editor.',
      },
      studentLesson: {
        title: 'Lições no ritmo de cada aluno',
        text: 'O aluno lê cada lição, responde a uma verificação rápida e vê sua pontuação. Você acompanha o progresso.',
        alt: 'Um aluno fazendo uma lição no celular.',
      },
      insights: {
        title: 'Saiba quem pode precisar de ajuda',
        text: 'A página de cada aluno reúne notas, frequência e anotações. Um resumo da IA sugere próximos passos para você avaliar.',
        alt: 'A página de um aluno com notas, frequência e um resumo da IA.',
      },
      parentPortal: {
        title: 'Mantenha as famílias informadas',
        text: 'As famílias abrem um link privado para ver as notas confirmadas e a frequência. Os recados semanais do Agente de preparação podem chegar a cada família no próprio idioma.',
        alt: 'O portal da família no celular, com notas e frequência.',
      },
      subPacket: {
        title: 'Esteja pronto para um substituto',
        text: 'O pacote para substituto reúne seu horário, a lista de alunos, os planos, as rotinas e os contatos, pronto para imprimir.',
        alt: 'Um pacote para substituto com horário, lista de alunos e rotinas.',
      },
      integrations: {
        title: 'Conecte suas ferramentas',
        text: 'Conecte Google Classroom, Google Drive, Microsoft OneDrive e Teams, Canva e sua agenda. Você escolhe o que é compartilhado, uma ferramenta de cada vez.',
        alt: 'A página de Ferramentas conectadas com Google, Microsoft e Canva.',
      },
      schoolSystems: {
        title: 'O sistema de cursos da sua escola',
        text: 'As escolas podem abrir o TeacherHubPro dentro do Canvas, Schoology, Moodle e D2L Brightspace e devolver as notas confirmadas, pelo padrão LTI 1.3. Disponível sob pedido.',
        alt: 'A seção de sistemas escolares em Ferramentas conectadas.',
      },
      schoolOverview: {
        title: 'A visão geral da escola',
        text: 'Os gestores escolares veem como cada professor usa o aplicativo e podem ligar ou desligar as funções de IA e os alertas sobre alunos para toda a escola.',
        alt: 'A visão geral da escola com o uso por professor e as opções para toda a escola.',
      },
      schoolUsers: {
        title: 'Gerencie os usuários da sua escola',
        text: 'Dê a professores e administradores o papel certo e passe uma turma para outro professor quando alguém sai.',
        alt: 'A página de usuários da escola com os papéis.',
      },
      approvals: {
        title: 'Um registro de cada decisão da IA',
        text: 'O trabalho da IA só chega a alunos e famílias depois que um professor o aprova. O registro de Aprovações mostra quem aprovou o quê e quando, sem nomes nem notas de alunos.',
        alt: 'O registro de Aprovações listando o que os professores aprovaram.',
      },
      dataExport: {
        title: 'Seus dados continuam seus',
        text: 'Baixe todos os dados da sua escola a qualquer momento, ou exclua você mesmo a escola e os dados dela.',
        alt: 'A página de configurações com o download e a exclusão dos dados da escola.',
      },
      languages: {
        title: 'Sete idiomas',
        text: 'Use o aplicativo em inglês, espanhol, francês, português, alemão, italiano ou chinês. A IA escreve no idioma que você escolher.',
        alt: 'A página de configurações com o seletor de idioma.',
      },
    },
  },
};
