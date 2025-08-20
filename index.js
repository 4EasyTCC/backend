require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const sequelize = require("./db");
const multer = require("multer");
const path = require("path");

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

const verificarToken = async (token) => {
  try {
    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.tipo === "organizador") {
      const organizador = await Organizador.findByPk(decoded.id);
      return organizador;
    } else if (decoded.tipo === "convidado") {
      const convidado = await Convidado.findByPk(decoded.id);
      return convidado;
    }

    return null;
  } catch (error) {
    console.error("Erro ao verificar token:", error);
    return null;
  }
};

const autenticar = async (req, res, next) => {
  try {
    console.log("Headers:", req.headers);
    const token = req.headers.authorization?.replace("Bearer ", "");
    console.log("Token recebido:", token);

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Token não fornecido" });
    }

    const usuario = await verificarToken(token);
    console.log("Usuário encontrado:", usuario);

    if (!usuario) {
      return res
        .status(401)
        .json({ success: false, message: "Token inválido" });
    }

    req.usuario = usuario;
    req.usuarioId = usuario.organizadorId || usuario.convidadoId;
    req.tipoUsuario =
      usuario instanceof Organizador ? "organizador" : "convidado";

    console.log("Autenticação bem-sucedida:", {
      usuarioId: req.usuarioId,
      tipoUsuario: req.tipoUsuario,
    });

    next();
  } catch (error) {
    console.error("Erro na autenticação:", error);
    return res
      .status(401)
      .json({ success: false, message: "Erro de autenticação" });
  }
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
      criarChat = true,
    } = req.body;

    if (
      !nome ||
      !descricao ||
      !tipo ||
      !privacidade ||
      !dataInicio ||
      !localizacao
    ) {
      return res.status(400).json({
        success: false,
        message: "Campos obrigatórios não preenchidos",
      });
    }

    const [localizacaoCriada] = await Localizacao.findOrCreate({
      where: {
        latitude: localizacao.latitude,
        longitude: localizacao.longitude,
        endereco: localizacao.endereco,
      },
      defaults: {
        endereco: localizacao.endereco,
        cidade: localizacao.cidade || null,
        estado: localizacao.estado || null,
        complemento: localizacao.complemento || null,
        cep: localizacao.cep || null,
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
      dataFim: dataFim || dataInicio,
      localizacaoId: localizacaoCriada.localizacaoId,
      statusEvento: status || "ativo",
      organizadorId: req.usuarioId,
    });

    if (fotos && fotos.length > 0) {
      for (const foto of fotos) {
        await Midia.create({
          url: foto.url,
          tipo: foto.tipo || "imagem",
          eventoId: evento.eventoId,
        });
      }
    }

    if (ingressos && ingressos.length > 0) {
      for (const ing of ingressos) {
        const ingressoData = {
          nome: ing.nome,
          quantidade: ing.quantidade || 0,
          preco: ing.preco || 0,
          descricao: ing.descricao || null,
          dataLimiteVenda: ing.dataLimiteVenda || null,
          eventoId: evento.eventoId,
        };

        await Ingresso.create(ingressoData);
      }
    }

    let grupoChat = null;
    if (criarChat) {
      grupoChat = await Grupo.create({
        nome: nome,
        descricao: `Grupo de chat do evento ${nome}`,
        tipo: "evento",
        eventoId: evento.eventoId,
        organizadorId: req.usuarioId,
      });
    }

    res.status(201).json({
      success: true,
      message: "Evento criado com sucesso!",
      evento,
      grupoChat,
    });
  } catch (error) {
    console.error("Erro ao criar evento:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao criar evento",
      error: error.message,
    });
  }
});
app.get("/eventos", autenticar, async (req, res) => {
  try {
    const eventos = await Evento.findAll({
      where: { organizadorId: req.usuarioId },
      include: [
        {
          model: Localizacao,
          as: "localizacao",
          attributes: ["endereco", "cidade", "estado"],
        },
        {
          model: Organizador,
          as: "organizador",
          attributes: ["organizadorId", "nome", "email"],
        },
      ],
      order: [["dataInicio", "ASC"]],
    });

    console.log(
      "Eventos encontrados:",
      eventos.map((e) => ({
        id: e.eventoId,
        nome: e.nomeEvento,
        organizador: e.organizador ? e.organizador.nome : "N/A",
      }))
    );

    res.status(200).json(eventos);
  } catch (error) {
    console.error("Erro ao buscar eventos:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao buscar eventos",
      error: error.message,
    });
  }
});

app.get("/perfil/organizador", autenticar, async (req, res) => {
  try {
    const organizador = await Organizador.findByPk(req.usuarioId, {
      attributes: ["organizadorId", "nome", "email", "avatarUrl"],
      include: [
        {
          model: Evento,
          as: "eventos",
          attributes: ["eventoId", "nomeEvento", "dataInicio"],
          limit: 5,
          order: [["dataInicio", "DESC"]],
        },
      ],
    });

    if (!organizador) {
      return res.status(404).json({
        success: false,
        message: "Organizador não encontrado",
      });
    }

    const estatisticas = {
      totalEventos: await Evento.count({
        where: { organizadorId: req.usuarioId },
      }),
      eventosAtivos: await Evento.count({
        where: {
          organizadorId: req.usuarioId,
          statusEvento: "ativo",
        },
      }),
    };

    res.json({
      success: true,
      perfil: {
        ...organizador.get({ plain: true }),
        estatisticas,
      },
    });
  } catch (error) {
    console.error("Erro no perfil organizador:", error);
    res.status(500).json({
      success: false,
      message: "Erro interno no servidor",
      error: error.message,
    });
  }
});
app.put(
  "/perfil/organizador/foto",
  autenticar,
  upload.single("avatar"),
  async (req, res) => {
    try {
      if (req.tipoUsuario !== "organizador") {
        return res.status(403).json({
          success: false,
          message: "Acesso não autorizado",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Nenhuma imagem enviada",
        });
      }

      const avatarUrl = `/uploads/${req.file.filename}`;

      await Organizador.update(
        { avatarUrl },
        { where: { organizadorId: req.usuarioId } }
      );

      res.json({
        success: true,
        message: "Foto atualizada com sucesso",
        avatarUrl,
      });
    } catch (error) {
      console.error("Erro ao atualizar foto:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao processar foto",
        error: error.message,
      });
    }
  }
);
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

    const estatisticas = {
      amigos: 10,
      eventos: 10,
      notificacoes: 10,
      avaliacoes: 10,
      categoriaMaisFrequente: "Festivais",
      localMaisVisitado: "Etasp",
    };

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

app.post("/upload", upload.single("arquivo"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Nenhum arquivo enviado." });
  }

  res.status(200).json({
    url: `/uploads/${req.file.filename}`,
    nomeArquivo: req.file.filename,
  });
});

const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error("Token não fornecido"));
  }

  verificarToken(token)
    .then((usuario) => {
      if (!usuario) {
        return next(new Error("Token inválido"));
      }
      socket.usuario = usuario;
      next();
    })
    .catch((error) => {
      next(new Error("Erro de autenticação"));
    });
});

io.on("connection", (socket) => {
  console.log("Usuário conectado:", socket.id);

  socket.on("entrar_grupo", (grupoId) => {
    socket.join(`grupo_${grupoId}`);
    console.log(`Usuário entrou no grupo ${grupoId}`);
  });

  socket.on("sair_grupo", (grupoId) => {
    socket.leave(`grupo_${grupoId}`);
    console.log(`Usuário saiu do grupo ${grupoId}`);
  });

  socket.on("disconnect", () => {
    console.log("Usuário desconectado:", socket.id);
  });
});
app.get("/grupos", autenticar, async (req, res) => {
  try {
    console.log(
      `Buscando grupos para usuário: ${req.usuarioId}, tipo: ${req.tipoUsuario}`
    );

    let grupos;

    if (req.tipoUsuario === "organizador") {
      console.log("Buscando grupos do organizador");
      grupos = await Grupo.findAll({
        where: { organizadorId: req.usuarioId },
        include: [
          {
            model: Evento,
            as: "evento",
            attributes: ["nomeEvento", "dataInicio"],
            required: false,
          },
        ],
      });
    } else {
      console.log("Buscando todos os grupos (convidado)");
      grupos = await Grupo.findAll({
        include: [
          {
            model: Evento,
            as: "evento",
            attributes: ["nomeEvento", "dataInicio"],
            required: false,
          },
        ],
      });
    }

    console.log(`Encontrados ${grupos.length} grupos`);

    res.json({
      success: true,
      grupos: grupos || [],
    });
  } catch (error) {
    console.error("Erro detalhado ao buscar grupos:", error);
    res.status(500).json({
      success: false,
      message: "Erro interno ao buscar grupos",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});
app.get("/mensagens/:grupoId", autenticar, async (req, res) => {
  try {
    const { grupoId } = req.params;
    console.log("Rota GET /mensagens/:grupoId alcançada para grupo:", grupoId);

    const grupo = await Grupo.findByPk(grupoId);
    if (!grupo) {
      return res
        .status(404)
        .json({ success: false, message: "Grupo não encontrado" });
    }

    const mensagens = await Mensagem.findAll({
      where: { grupoId },
      include: [
        {
          model: req.tipoUsuario === "organizador" ? Organizador : Convidado,
          as: "organizador",
          attributes: ["nome", "email"],
        },
      ],
      order: [["createdAt", "ASC"]],
    });

    console.log(
      `Encontradas ${mensagens.length} mensagens para o grupo ${grupoId}`
    );

    res.json({ success: true, mensagens });
  } catch (error) {
    console.error("Erro ao buscar mensagens:", error);
    res
      .status(500)
      .json({ success: false, message: "Erro interno do servidor" });
  }
});

app.get("/mensagens/:grupoId", autenticar, async (req, res) => {
  try {
    const { grupoId } = req.params;

    const mensagens = await Mensagem.findAll({
      where: { grupoId },
      order: [["createdAt", "ASC"]],
    });

    const mensagensCompletas = await Promise.all(
      mensagens.map(async (msg) => {
        let usuario;

        if (msg.tipoUsuario === "organizador") {
          usuario = await Organizador.findByPk(msg.usuarioId, {
            attributes: ["nome", "email"],
          });
        } else {
          usuario = await Convidado.findByPk(msg.usuarioId, {
            attributes: ["nome", "email"],
          });
        }

        return {
          ...msg.toJSON(),
          usuario: usuario || { nome: "Usuário desconhecido" },
        };
      })
    );

    res.json({ success: true, mensagens: mensagensCompletas });
  } catch (error) {
    console.error("Erro ao buscar mensagens:", error);
    res
      .status(500)
      .json({ success: false, message: "Erro interno do servidor" });
  }
});

app.post("/mensagens/:grupoId", autenticar, async (req, res) => {
  try {
    const { grupoId } = req.params;
    const { texto } = req.body;

    const novaMensagem = await Mensagem.create({
      texto,
      grupoId,
      usuarioId: req.usuarioId,
      tipoUsuario: req.tipoUsuario,
    });

    let usuario;
    if (req.tipoUsuario === "organizador") {
      usuario = await Organizador.findByPk(req.usuarioId, {
        attributes: ["nome", "email"],
      });
    } else {
      usuario = await Convidado.findByPk(req.usuarioId, {
        attributes: ["nome", "email"],
      });
    }

    const mensagemCompleta = {
      ...novaMensagem.toJSON(),
      usuario: usuario || { nome: "Usuário desconhecido" },
    };

    io.to(`grupo_${grupoId}`).emit("nova_mensagem", mensagemCompleta);

    res.json({ success: true, mensagem: mensagemCompleta });
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
    res
      .status(500)
      .json({ success: false, message: "Erro interno do servidor" });
  }
});

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
