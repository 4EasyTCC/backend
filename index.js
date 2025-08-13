require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const sequelize = require("./db");
const multer = require("multer");
const path = require("path");

// MODELS
const Organizador = require("./models/Organizador");
const Evento = require("./models/Evento");
const Localizacao = require("./models/Localizacao");
const Midia = require("./models/Midia");
const Ingresso = require("./models/Ingresso");
const Convidado = require("./models/Convidado");
const Mensagem = require("./models/Mensagem");
const Grupo = require("./models/Grupo");

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

const autenticar = (req, res, next) => {
  const token = req.headers["authorization"];
  console.log("Token recebido:", token);

  if (!token) {
    return res.status(401).json({ message: "Token não fornecido" });
  }

  const tokenClean = token.replace("Bearer ", "");
  console.log("Token limpo:", tokenClean);

  jwt.verify(tokenClean, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error("Erro detalhado:", err);
      return res.status(401).json({ message: "Token inválido" });
    }
    req.usuarioId = decoded.id;
    next();
  });
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// ROTAS ORGANIZADOR
app.post("/cadastro/organizador", async (req, res) => {
  const { nome, email, senha } = req.body;

  try {
    const novoOrganizador = await Organizador.create({ nome, email, senha });
    res.status(201).json({
      message: "Usuário cadastrado com sucesso!",
      organizador: novoOrganizador,
    });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({ message: "Email já cadastrado!" });
    }

    console.error("Erro ao criar organizador", error);
    res.status(500).send("Erro ao criar organizador");
  }
});

app.post("/login/organizador", async (req, res) => {
  const { email, senha } = req.body;

  try {
    const organizador = await Organizador.findOne({
      where: { email },
      attributes: ["organizadorId", "nome", "email", "senha"],
    });

    if (!organizador || organizador.senha !== senha) {
      return res.status(401).json({ message: "Credenciais inválidas" });
    }

    const token = jwt.sign(
      {
        id: organizador.organizadorId,
        tipo: "organizador",
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    const { senha: _, ...organizadorSemSenha } = organizador.dataValues;

    res.status(200).json({
      message: "Login bem-sucedido",
      token,
      organizador: organizadorSemSenha,
    });
  } catch (error) {
    console.error("Erro detalhado:", error);
    res.status(500).json({
      message: "Erro ao processar login",
      error: error.message,
    });
  }
});

app.post("/eventos", autenticar, async (req, res) => {
  try {
    const {
      nome,
      descricao,
      tipo,
      privacidade,
      dataInicio,
      dataFim,
      localizacao,
      fotos,
      ingressos,
      status,
    } = req.body;

    const [localizacaoCriada] = await Localizacao.findOrCreate({
      where: {
        latitude: localizacao.latitude,
        longitude: localizacao.longitude,
        endereco: localizacao.endereco,
        cidade: localizacao.cidade || null,
        estado: localizacao.estado || null,
      },
      defaults: {
        endereco: localizacao.endereco,
        cidade: localizacao.cidade || null,
        estado: localizacao.estado || null,
        complemento: localizacao.complemento || null,
        cep: localizacao.cep,
        latitude: localizacao.latitude,
        longitude: localizacao.longitude,
      },
    });

    const evento = await Evento.create({
      nomeEvento: nome,
      descEvento: descricao,
      tipoEvento: tipo,
      privacidadeEvento: privacidade,
      dataInicio,
      dataFim,
      localizacaoId: localizacaoCriada.localizacaoId,
      statusEvento: status,
      organizadorId: req.usuarioId,
    });

    if (fotos?.galeria) {
      await Promise.all(
        fotos.galeria.map((url) =>
          Midia.create({
            eventoId: evento.eventoId,
            tipo: "imagem",
            url,
          })
        )
      );
    }

    if (ingressos?.length > 0) {
      await Promise.all(
        ingressos.map((ingresso) =>
          Ingresso.create({
            eventoId: evento.eventoId,
            nome: ingresso.nome,
            descricao: ingresso.descricao,
            preco: ingresso.preco,
            quantidade: ingresso.quantidade,
            dataLimite: ingresso.dataLimite,
          })
        )
      );
    }

    res.status(201).json({
      success: true,
      eventoId: evento.eventoId,
    });
  } catch (error) {
    console.error("Erro ao criar evento completo:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao criar evento",
    });
  }
});

app.get("/eventos", autenticar, async (req, res) => {
  try {
    const eventos = await Evento.findAll({
      where: { organizadorId: req.usuarioId },
      include: [
        { model: Localizacao },
        { model: Organizador, attributes: ["nome"] },
      ],
      order: [["dataInicio", "ASC"]],
    });

    res.status(200).json(eventos);
  } catch (error) {
    console.error("Erro ao buscar eventos:", error);
    res.status(500).json({ message: "Erro ao buscar eventos" });
  }
});

// ROTAS CONVIDADO
app.post("/cadastro/convidado", async (req, res) => {
  try {
    const {
      nome,
      cpf,
      email,
      senha,
      telefone,
      genero,
      dataNascimento,
      endereco,
      cidade,
      cep,
    } = req.body;

    if (!cpf || !email) {
      return res.status(400).json({
        success: false,
        message: "CPF e email são obrigatórios",
      });
    }

    const cpfLimpo = cpf.replace(/\D/g, "");

    const cpfExistente = await Convidado.findOne({ where: { cpf: cpfLimpo } });
    if (cpfExistente) {
      return res.status(400).json({
        success: false,
        message: "CPF já cadastrado",
      });
    }

    const emailExistente = await Convidado.findOne({ where: { email } });
    if (emailExistente) {
      return res.status(400).json({
        success: false,
        message: "Email já cadastrado",
      });
    }

    const convidadoCriado = await Convidado.create({
      nome,
      cpf: cpfLimpo,
      email,
      senha,
      telefone: telefone?.replace(/\D/g, "") || null,
      genero,
      dataNascimento,
      endereco,
      cidade,
      cep: cep?.replace(/\D/g, "") || null,
    });

    const convidadoResponse = convidadoCriado.toJSON();
    delete convidadoResponse.senha;

    res.status(201).json({
      success: true,
      message: "Cadastro realizado com sucesso",
      data: convidadoResponse,
    });
  } catch (error) {
    console.error("Erro no cadastro:", error);
    let mensagem = "Erro ao cadastrar convidado";
    if (error.name === "SequelizeValidationError") {
      mensagem = error.errors.map((e) => e.message).join(", ");
    } else if (error.name === "SequelizeUniqueConstraintError") {
      mensagem = "Dados duplicados (CPF ou email já existem)";
    }

    res.status(500).json({
      success: false,
      message: mensagem,
      error: error.message,
    });
  }
});

app.post("/login/convidado", async (req, res) => {
  const { email, senha } = req.body;

  try {
    const convidado = await Convidado.findOne({
      where: { email },
      attributes: ["convidadoId", "nome", "email", "senha", "cpf"],
    });

    if (!convidado || convidado.senha !== senha) {
      return res.status(401).json({
        success: false,
        message: "Credenciais inválidas",
      });
    }

    const token = jwt.sign(
      {
        id: convidado.convidadoId,
        tipo: "convidado",
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    const convidadoResponse = convidado.toJSON();
    delete convidadoResponse.senha;

    res.status(200).json({
      success: true,
      message: "Login realizado com sucesso",
      token,
      convidado: convidadoResponse,
    });
  } catch (error) {
    console.error("Erro no login:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao processar login",
      error: error.message,
    });
  }
});
// Rota GET perfil do convidado logado
app.get("/perfil/convidado", autenticar, async (req, res) => {
  try {
    const convidado = await Convidado.findByPk(req.usuarioId, {
      attributes: ["convidadoId", "nome", "email", "avatarUrl", "sobreMim"],
    });

    if (!convidado) {
      return res
        .status(404)
        .json({ success: false, message: "Convidado não encontrado" });
    }

    // Estatísticas (mock — depois pode vir do banco real)
    const estatisticas = {
      amigos: 10,
      eventos: 10,
      notificacoes: 10,
      avaliacoes: 10,
      categoriaMaisFrequente: "Festivais",
      localMaisVisitado: "Etasp",
    };

    // Favoritos (mock — pode vir de tabela separada)
    const eventosFavoritos = Array(6).fill({
      nome: "Evento X",
      imagem: "/uploads/evento.png",
    });
    const profissoesFavoritas = Array(6).fill({
      nome: "DJ",
      imagem: "/uploads/profissao.png",
    });

    res.json({
      success: true,
      convidado,
      estatisticas,
      eventosFavoritos,
      profissoesFavoritas,
    });
  } catch (error) {
    console.error("Erro ao buscar perfil:", error);
    res.status(500).json({ success: false, message: "Erro ao buscar perfil" });
  }
});

// UPLOAD DE ARQUIVO
app.post("/upload", upload.single("arquivo"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Nenhum arquivo enviado." });
  }

  res.status(200).json({
    url: `/uploads/${req.file.filename}`,
    nomeArquivo: req.file.filename,
  });
});

// SOCKET.IO
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("Usuário conectado ao chat");

  socket.on("entrarGrupo", ({ grupoId }) => {
    socket.join(`grupo-${grupoId}`);
  });

  socket.on("mensagem", async (msg) => {
    const novaMensagem = await Mensagem.create(msg);
    io.to(`grupo-${msg.grupoId}`).emit("mensagemRecebida", novaMensagem);
  });

  socket.on("disconnect", () => {
    console.log("Usuário saiu do chat");
  });
});

app.post("/mensagens", autenticar, async (req, res) => {
  try {
    const { conteudo, tipo, grupoId, urlArquivo } = req.body;

    const novaMensagem = await Mensagem.create({
      conteudo,
      tipo: tipo || "texto",
      grupoId,
      remetenteId: req.usuarioId,
      remetenteTipo: req.tipo || "organizador",
      urlArquivo: urlArquivo || null,
    });

    res.status(201).json({
      success: true,
      mensagem: novaMensagem,
    });
  } catch (error) {
    console.error("Erro ao criar mensagem:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao criar mensagem",
      error: error.message,
    });
  }
});

// BUSCAR MENSAGENS
app.get("/mensagens/:grupoId", autenticar, async (req, res) => {
  try {
    const { grupoId } = req.params;

    const mensagens = await Mensagem.findAll({
      where: { grupoId },
      order: [["createdAt", "ASC"]],
    });

    res.status(200).json(mensagens);
  } catch (error) {
    console.error("Erro ao buscar mensagens:", error);
    res.status(500).json({ message: "Erro ao buscar mensagens" });
  }
});
// Exemplo usando Express + Sequelize
app.get("/mensagens/grupo/:grupoId", async (req, res) => {
  const { grupoId } = req.params;

  try {
    const mensagens = await Mensagem.findAll({
      where: { grupoId },
      order: [["createdAt", "ASC"]],
    });

    res.json({ success: true, mensagens });
  } catch (error) {
    console.error("Erro ao buscar mensagens:", error);
    res.status(500).json({ success: false, erro: "Erro interno" });
  }
});

// START SERVER
http.listen(PORT, () => {
  console.log(`Servidor rodando com Socket.IO na porta: ${PORT}`);
});

sequelize
  .sync({ force: false })
  .then(() => {
    console.log("Modelos sincronizados com o banco de dados");
  })
  .catch((err) => {
    console.error("Erro ao sincronizar modelos:", err);
  });
