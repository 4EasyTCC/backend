require("dotenv").config();
const sequelize = require("./db");

// Continuamos importando todos os modelos para que o sync() funcione corretamente.
const Organizador = require("./models/Organizador");
const Evento = require("./models/Evento");
const Localizacao = require("./models/Localizacao");
const Midia = require("./models/Midia");
const Ingresso = require("./models/Ingresso");
const Convidado = require("./models/Convidado");
const Grupo = require("./models/Grupo");
const MembrosGrupo = require("./models/MembrosGrupo");
const Mensagem = require("./models/Mensagem");
const Participacao = require("./models/Participacao");

async function seedDatabase() {
  try {
    console.log("Iniciando a operação no banco de dados...");

    // Em vez de usar sequelize.drop(), vamos apagar as tabelas manualmente na ordem correta.
    console.log("Apagando tabelas manualmente...");
await sequelize.query("IF OBJECT_ID('dbo.Participacao', 'U') IS NOT NULL DROP TABLE dbo.Participacao;", { raw: true });
await sequelize.query("IF OBJECT_ID('dbo.MembrosGrupo', 'U') IS NOT NULL DROP TABLE dbo.MembrosGrupo;", { raw: true });
await sequelize.query("IF OBJECT_ID('dbo.Mensagem', 'U') IS NOT NULL DROP TABLE dbo.Mensagem;", { raw: true });
await sequelize.query("IF OBJECT_ID('dbo.Ingresso', 'U') IS NOT NULL DROP TABLE dbo.Ingresso;", { raw: true });
await sequelize.query("IF OBJECT_ID('dbo.Midia', 'U') IS NOT NULL DROP TABLE dbo.Midia;", { raw: true });
await sequelize.query("IF OBJECT_ID('dbo.Grupo', 'U') IS NOT NULL DROP TABLE dbo.Grupo;", { raw: true });
await sequelize.query("IF OBJECT_ID('dbo.Evento', 'U') IS NOT NULL DROP TABLE dbo.Evento;", { raw: true });
await sequelize.query("IF OBJECT_ID('dbo.Organizador', 'U') IS NOT NULL DROP TABLE dbo.Organizador;", { raw: true });
await sequelize.query("IF OBJECT_ID('dbo.Convidado', 'U') IS NOT NULL DROP TABLE dbo.Convidado;", { raw: true });
await sequelize.query("IF OBJECT_ID('dbo.Localizacao', 'U') IS NOT NULL DROP TABLE dbo.Localizacao;", { raw: true });
    
console.log("Tabelas apagadas com sucesso.");
    
    console.log("Sincronizando e recriando as tabelas (sync)...");
    await sequelize.sync(); 
    console.log("Banco de dados sincronizado.");

    // 1. Criar um organizador padrão
    console.log("Criando organizador padrão...");
    const organizador = await Organizador.create({
      nome: "Organizador Exemplo",
      email: "organizador@exemplo.com",
      senha: "senha123",
    });
    console.log("Organizador criado com sucesso.");

    // 2. Criar localizações
    console.log("Criando localizações...");
    const localizacoes = await Localizacao.bulkCreate([
      {
        endereco: "Avenida Paulista, 1000",
        cidade: "São Paulo",
        estado: "SP",
        cep: "01310-100",
        latitude: -23.563099,
        longitude: -46.654279,
      },
      {
        endereco: "Praça da Liberdade, 100",
        cidade: "Belo Horizonte",
        estado: "MG",
        cep: "30140-010",
        latitude: -19.934937,
        longitude: -43.938424,
      },
      {
        endereco: "Praia de Copacabana, 200",
        cidade: "Rio de Janeiro",
        estado: "RJ",
        cep: "22070-010",
        latitude: -22.971177,
        longitude: -43.182543,
      },
    ]);
    console.log("Localizações criadas com sucesso.");

    // 3. Criar eventos
    console.log("Criando eventos...");
    const eventos = await Evento.bulkCreate([
      {
        nomeEvento: "Festival de Música Verão 2025",
        descEvento: "Um incrível festival com as melhores bandas nacionais e internacionais na bela praia de Copacabana.",
        categoria: "Festas e Shows",
        privacidadeEvento: "Público",
        dataInicio: "2025-12-15",
        horaInicio: "16:00:00",
        dataFim: "2025-12-16",
        horaFim: "02:00:00",
        statusEvento: "ativo",
        localizacaoId: localizacoes[2].localizacaoId, // Rio de Janeiro
        organizadorId: organizador.organizadorId,
      },
      {
        nomeEvento: "Workshop de Gastronomia Italiana",
        descEvento: "Aprenda a fazer massas e molhos autênticos da Itália com chefs renomados, no coração de São Paulo.",
        categoria: "Gastronomia",
        privacidadeEvento: "Público",
        dataInicio: "2025-11-10",
        horaInicio: "14:00:00",
        dataFim: "2025-11-10",
        horaFim: "18:00:00",
        statusEvento: "ativo",
        localizacaoId: localizacoes[0].localizacaoId, // São Paulo
        organizadorId: organizador.organizadorId,
      },
      {
        nomeEvento: "Maratona de São Paulo 2026",
        descEvento: "Participe da maior corrida de rua da América Latina, com percurso de 42km pelas principais ruas da cidade.",
        categoria: "Esporte",
        privacidadeEvento: "Público",
        dataInicio: "2026-04-07",
        horaInicio: "06:00:00",
        dataFim: "2026-04-07",
        horaFim: "12:00:00",
        statusEvento: "ativo",
        localizacaoId: localizacoes[0].localizacaoId, // São Paulo
        organizadorId: organizador.organizadorId,
      },
    ]);
    console.log("Eventos criados com sucesso.");

    // 4. Adicionar mídias (capas)
    console.log("Adicionando mídias...");
    await Midia.bulkCreate([
      {
        eventoId: eventos[0].eventoId,
        url: "/uploads/evento1.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[1].eventoId,
        url: "/uploads/evento2.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[2].eventoId,
        url: "/uploads/evento3.jpeg",
        tipo: "capa",
      },
    ]);
    console.log("Mídias adicionadas com sucesso.");

    // 5. Adicionar ingressos
    console.log("Adicionando ingressos...");
    await Ingresso.bulkCreate([
      {
        eventoId: eventos[0].eventoId,
        nome: "Pista",
        descricao: "Acesso à área principal do festival",
        preco: 150.0,
        quantidade: 5000,
        dataLimiteVenda: "2025-12-14",
      },
      {
        eventoId: eventos[0].eventoId,
        nome: "VIP",
        descricao: "Área exclusiva com open bar e comida",
        preco: 350.0,
        quantidade: 1000,
        dataLimiteVenda: "2025-12-14",
      },
      {
        eventoId: eventos[1].eventoId,
        nome: "Participante",
        descricao: "Inclui todos os materiais e degustação. Evento gratuito!",
        preco: 0,
        quantidade: 20,
        dataLimiteVenda: "2025-11-08",
      },
      {
        eventoId: eventos[2].eventoId,
        nome: "Corredor",
        descricao: "Inscrição para a maratona completa com kit de participação.",
        preco: 120.0,
        quantidade: 1000,
        dataLimiteVenda: "2026-04-01",
      },
    ]);
    console.log("Ingressos adicionados com sucesso.");



    console.log("✅ Processo de seed finalizado com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao popular o banco de dados:", error);
  } finally {
    // Adicionar uma pequena pausa antes de fechar.
    console.log("Aguardando 2 segundos para garantir que todas as operações terminaram...");
    await new Promise(res => setTimeout(res, 2000)); // Pausa de 2 segundos

    await sequelize.close();
    console.log("Conexão com o banco de dados fechada.");
  }
}

seedDatabase();

//node seed.js
