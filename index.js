require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const sequelize = require("./db");
const multer = require("multer");
const path = require("path");
const { Op } = require("sequelize");
const Organizador = require("./models/Organizador");
const Evento = require("./models/Evento");
const Localizacao = require("./models/Localizacao");
const Midia = require("./models/Midia");
const Ingresso = require("./models/Ingresso");
const Convidado = require("./models/Convidado");
const Mensagem = require("./models/Mensagem");
const Grupo = require("./models/Grupo");
const Participacao = require("./models/Participacao");
const MembrosGrupo = require("./models/MembrosGrupo");
const Favorito = require("./models/Favorito");
const CompraIngresso = require("./models/CompraIngresso");

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const filtrarPorPeriodo = (eventos, periodo) => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);

  const finalSemana = new Date(hoje);
  // Encontrar o próximo sábado
  finalSemana.setDate(finalSemana.getDate() + (6 - hoje.getDay()));

  const proximaSemanaInicio = new Date(hoje);
  proximaSemanaInicio.setDate(proximaSemanaInicio.getDate() + 7);
  const proximaSemanaFim = new Date(proximaSemanaInicio);
  proximaSemanaFim.setDate(proximaSemanaFim.getDate() + 6);

  const esteMesFim = new Date(hoje);
  esteMesFim.setMonth(esteMesFim.getMonth() + 1);
  esteMesFim.setDate(0); // Último dia do mês atual

  return eventos.filter((evento) => {
    if (!evento.dataInicio) return false;

    const dataEvento = new Date(evento.dataInicio);
    dataEvento.setHours(0, 0, 0, 0);

    switch (periodo) {
      case "hoje":
        return dataEvento.getTime() === hoje.getTime();
      case "amanha":
        return dataEvento.getTime() === amanha.getTime();
      case "esta-semana":
        return dataEvento >= hoje && dataEvento <= finalSemana;
      case "proxima-semana":
        return (
          dataEvento >= proximaSemanaInicio && dataEvento <= proximaSemanaFim
        );
      case "este-mes":
        return dataEvento >= hoje && dataEvento <= esteMesFim;
      default:
        return true;
    }
  });
};

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
      categoria: tipo,
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

      // NOVO: Adicionar o organizador como membro do grupo (usando MembrosGrupo)
      // Como a tabela MembrosGrupo foi feita focando em convidado, apenas criaremos o grupo.
      // A rota de mensagens já permite ao organizador enviar.
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
        { model: Organizador, as: "organizador" },
        { model: Localizacao, as: "localizacao" },
        { model: Midia }, // sem alias
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
    return res.status(500).json({
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
      // ✅ CORREÇÃO: Adicionar avatarUrl nos attributes
      attributes: ["convidadoId", "nome", "email", "senha", "cpf", "avatarUrl"],
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
      convidado: convidadoResponse, // ✅ Agora inclui avatarUrl
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
// CORREÇÃO: Atualize a rota GET /perfil/convidado no backend
app.get("/perfil/convidado", autenticar, async (req, res) => {
  try {
    const convidado = await Convidado.findByPk(req.usuarioId, {
      // ✅ CORREÇÃO: Garantir que avatarUrl está incluído
      attributes: [
        'convidadoId', 'nome', 'email', 'cpf', 'telefone', 'genero',
        'dataNascimento', 'endereco', 'cidade', 'cep', 'avatarUrl', 'sobreMim'
      ],
    });

    if (!convidado) {
      return res.status(404).json({
        success: false,
        message: "Convidado não encontrado"
      });
    }

    // Buscar favoritos reais do convidado (se houver)
    let eventosFavoritos = [];
    try {
      const favoritos = await Favorito.findAll({
        where: { convidadoId: req.usuarioId },
        include: [
          {
            model: Evento,
            as: 'evento',
            include: [
              { model: Localizacao, as: 'localizacao', attributes: ['endereco', 'cidade', 'estado'] },
              { model: Organizador, as: 'organizador', attributes: ['nome', 'avatarUrl'] },
              { model: Midia, attributes: ['url', 'tipo'], required: false },
            ],
          },
        ],
        order: [['createdAt', 'DESC']],
      });

      eventosFavoritos = favoritos
        .map(f => f.evento)
        .filter(Boolean)
        .map(e => ({
          eventoId: e.eventoId,
          nomeEvento: e.nomeEvento,
          dataInicio: e.dataInicio,
          localizacao: e.localizacao,
          organizador: e.organizador,
          Midia: e.Midia,
        }));
    } catch (err) {
      console.warn('Não foi possível carregar favoritos do banco:', err.message || err);
      eventosFavoritos = [];
    }

    // Buscar histórico de compras do convidado
    let comprasHistorico = [];
    try {
      const compras = await CompraIngresso.findAll({
        where: { convidadoId: req.usuarioId },
        include: [
          {
            model: Ingresso,
            as: 'ingressoComprado',
            attributes: ['ingressoId', 'nome', 'preco', 'eventoId'],
            include: [
              { model: Evento, attributes: ['eventoId', 'nomeEvento'] }
            ]
          }
        ],
        order: [['createdAt', 'DESC']],
      });

      comprasHistorico = compras.map(c => {
        const ing = c.ingressoComprado || null;
        const evt = ing ? (ing.Evento || null) : null; // Evento sem alias costuma aparecer como 'Evento'

        return {
          compraId: c.compraId,
          ingressoId: c.ingressoId,
          quantidade: c.quantidade,
          valorTotal: c.valorTotal,
          statusPagamento: c.statusPagamento,
          compradoEm: c.createdAt,
          ingresso: ing ? {
            ingressoId: ing.ingressoId,
            nome: ing.nome,
            preco: ing.preco,
            eventoId: ing.eventoId,
            eventoNome: evt ? evt.nomeEvento : undefined
          } : null
        };
      });
    } catch (err) {
      console.warn('Erro ao buscar histórico de compras:', err.message || err);
      comprasHistorico = [];
    }

    res.json({
      success: true,
      convidado: convidado,
      estatisticas: {
        amigos: 10,
        eventos: 10,
        notificacoes: 10,
        avaliacoes: 10,
        categoriaMaisFrequente: "Festivais",
        localMaisVisitado: "Etasp",
      },
      eventosFavoritos,
      eventosFavoritosMensagem: eventosFavoritos.length ? undefined : "Usuário não possui eventos favoritados",
      profissoesFavoritas: [],
      profissoesFavoritasMensagem: "Usuário não possui profissionais favoritados",
      comprasHistorico,
    });
  } catch (error) {
    console.error("Erro ao buscar perfil:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao buscar perfil"
    });
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

// Associações do modelo Favorito (se necessário)
try {
  Favorito.belongsTo(Convidado, { foreignKey: 'convidadoId', as: 'convidado' });
  Favorito.belongsTo(Evento, { foreignKey: 'eventoId', as: 'evento' });
  Favorito.belongsTo(Organizador, { foreignKey: 'organizadorId', as: 'organizador' });
} catch (e) {
  console.warn('Aviso ao configurar associações de Favorito:', e.message || e);
}

// ROTAS DE FAVORITOS (para convidados)
app.get('/favoritos', autenticar, async (req, res) => {
  try {
    if (req.tipoUsuario !== 'convidado') {
      return res.status(403).json({ success: false, message: 'Apenas convidados podem acessar favoritos' });
    }

    const favoritos = await Favorito.findAll({
      where: { convidadoId: req.usuarioId },
      include: [
        {
          model: Evento,
          as: 'evento',
          include: [
            { model: Localizacao, as: 'localizacao', attributes: ['endereco', 'cidade', 'estado'] },
            { model: Organizador, as: 'organizador', attributes: ['nome', 'avatarUrl'] },
            { model: Midia, attributes: ['url', 'tipo'], required: false },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const eventosFavoritos = favoritos
      .map(f => f.evento)
      .filter(Boolean)
      .map(e => ({
        eventoId: e.eventoId,
        nomeEvento: e.nomeEvento,
        dataInicio: e.dataInicio,
        localizacao: e.localizacao,
        organizador: e.organizador,
        Midia: e.Midia,
      }));

    res.json({ success: true, eventosFavoritos });
  } catch (error) {
    console.error('Erro ao buscar favoritos:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar favoritos' });
  }
});

app.post('/favoritos', autenticar, async (req, res) => {
  try {
    if (req.tipoUsuario !== 'convidado') {
      return res.status(403).json({ success: false, message: 'Apenas convidados podem favoritar eventos' });
    }

    const { eventoId } = req.body;
    if (!eventoId) {
      return res.status(400).json({ success: false, message: 'eventoId é obrigatório' });
    }

    const evento = await Evento.findByPk(eventoId);
    if (!evento) {
      return res.status(404).json({ success: false, message: 'Evento não encontrado' });
    }

    // Cria apenas se não existir (unique index garante integridade)
    const [fav, created] = await Favorito.findOrCreate({
      where: { convidadoId: req.usuarioId, eventoId },
    });

    return res.status(created ? 201 : 200).json({ success: true, favorito: fav, created });
  } catch (error) {
    console.error('Erro ao criar favorito:', error);
    res.status(500).json({ success: false, message: 'Erro ao criar favorito' });
  }
});

app.delete('/favoritos/:eventoId', autenticar, async (req, res) => {
  try {
    if (req.tipoUsuario !== 'convidado') {
      return res.status(403).json({ success: false, message: 'Apenas convidados podem remover favoritos' });
    }

    const { eventoId } = req.params;
    const deleted = await Favorito.destroy({ where: { convidadoId: req.usuarioId, eventoId } });
    if (deleted === 0) {
      return res.status(404).json({ success: false, message: 'Favorito não encontrado' });
    }

    res.json({ success: true, message: 'Favorito removido' });
  } catch (error) {
    console.error('Erro ao remover favorito:', error);
    res.status(500).json({ success: false, message: 'Erro ao remover favorito' });
  }
});

// ROTAS DE FAVORITOS DE ORGANIZADORES
app.get('/favoritos/organizadores', autenticar, async (req, res) => {
  try {
    if (req.tipoUsuario !== 'convidado') {
      return res.status(403).json({ success: false, message: 'Apenas convidados podem acessar favoritos' });
    }

    const favoritos = await Favorito.findAll({
      where: { convidadoId: req.usuarioId, organizadorId: { [Op.ne]: null } },
      include: [
        {
          model: Organizador,
          as: 'organizador',
          attributes: ['organizadorId', 'nome', 'avatarUrl']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    const organizadoresFavoritos = favoritos.map(f => f.organizador).filter(Boolean).map(o => ({ organizadorId: o.organizadorId, nome: o.nome, avatarUrl: o.avatarUrl }));

    res.json({ success: true, organizadoresFavoritos });
  } catch (error) {
    console.error('Erro ao buscar favoritos de organizadores:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar favoritos de organizadores' });
  }
});

app.post('/favoritos/organizadores', autenticar, async (req, res) => {
  try {
    if (req.tipoUsuario !== 'convidado') {
      return res.status(403).json({ success: false, message: 'Apenas convidados podem favoritar organizadores' });
    }

    const { organizadorId } = req.body;
    if (!organizadorId) return res.status(400).json({ success: false, message: 'organizadorId é obrigatório' });

    const organizador = await Organizador.findByPk(organizadorId);
    if (!organizador) return res.status(404).json({ success: false, message: 'Organizador não encontrado' });

    const [fav, created] = await Favorito.findOrCreate({ where: { convidadoId: req.usuarioId, organizadorId } });
    return res.status(created ? 201 : 200).json({ success: true, favorito: fav, created });
  } catch (error) {
    console.error('Erro ao criar favorito de organizador:', error);
    res.status(500).json({ success: false, message: 'Erro ao criar favorito de organizador' });
  }
});

app.delete('/favoritos/organizadores/:organizadorId', autenticar, async (req, res) => {
  try {
    if (req.tipoUsuario !== 'convidado') {
      return res.status(403).json({ success: false, message: 'Apenas convidados podem remover favoritos' });
    }

    const { organizadorId } = req.params;
    const deleted = await Favorito.destroy({ where: { convidadoId: req.usuarioId, organizadorId } });
    if (deleted === 0) return res.status(404).json({ success: false, message: 'Favorito não encontrado' });
    res.json({ success: true, message: 'Favorito de organizador removido' });
  } catch (error) {
    console.error('Erro ao remover favorito de organizador:', error);
    res.status(500).json({ success: false, message: 'Erro ao remover favorito de organizador' });
  }
});

// REMOVIDA ROTA ANTIGA /grupos DE ORGANIZADOR

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

app.get("/api/eventos/busca-nome", async (req, res) => {
  try {
    const { query, limite = 10 } = req.query;

    console.log(`[BUSCA] Recebida busca por: "${query}"`);

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Parâmetro de busca é obrigatório",
      });
    }

    // Buscar eventos - mesmo que não encontre nada, retorna array vazio
    // SQL Server does not support ILIKE. Use LOWER + LIKE for case-insensitive search.
    console.log(`[BUSCA] Executando busca (mssql-compatible) por: ${query}`);
    const eventos = await Evento.findAll({
      where: {
        statusEvento: "ativo",
        // Use literal to produce: LOWER([nomeEvento]) LIKE '%query%'
        [Op.and]: sequelize.where(
          sequelize.fn('LOWER', sequelize.col('nomeEvento')),
          {
            [Op.like]: `%${query.toLowerCase()}%`,
          }
        ),
      },
      include: [
        {
          model: Localizacao,
          as: "localizacao",
          attributes: ["endereco", "cidade", "estado"],
        },
        {
          model: Organizador,
          as: "organizador",
          attributes: ["nome", "avatarUrl"],
        },
        {
          model: Ingresso,
          attributes: ["preco"],
          required: false,
        },
        {
          model: Midia,
          attributes: ["url", "tipo"],
          required: false,
        },
      ],
      order: [["dataInicio", "ASC"]],
      limit: parseInt(limite),
    });

    console.log(`[BUSCA] Encontrados ${eventos.length} eventos para "${query}"`);

    // Formatar os dados para resposta - mesmo se array estiver vazio
    const eventosFormatados = eventos.map(evento => ({
      eventoId: evento.eventoId,
      nomeEvento: evento.nomeEvento,
      descEvento: evento.descEvento,
      dataInicio: evento.dataInicio,
      horaInicio: evento.horaInicio,
      categoria: evento.categoria,
      localizacao: evento.localizacao,
      organizador: evento.organizador,
      Ingressos: evento.Ingressos,
      Midia: evento.Midia,
    }));

    res.status(200).json({
      success: true,
      eventos: eventosFormatados,
      total: eventosFormatados.length,
    });
  } catch (error) {
    console.error("Erro detalhado na busca de eventos:", error);

    // Em caso de erro, retorna array vazio em vez de erro 500
    res.status(200).json({
      success: true,
      eventos: [],
      total: 0,
      message: "Nenhum evento encontrado"
    });
  }
});

app.get("/api/eventos/filtrados", async (req, res) => {
  try {
    const {
      categoria,
      preco,
      tipo,
      localizacao,
      pagina = 1,
      limite = 24,
    } = req.query;

    const offset = (parseInt(pagina) - 1) * parseInt(limite);
    let whereClause = { statusEvento: "ativo" };

    let includeClause = [
      {
        model: Localizacao,
        as: "localizacao",
        attributes: ["endereco", "cidade", "estado"],
      },
      {
        model: Organizador,
        as: "organizador",
        attributes: ["nome"],
      },
      {
        model: Ingresso,
        attributes: ["preco"],
        required: false, // Importantíssimo: não requer ingresso para evitar excluir eventos sem ingressos
      },
      {
        model: Midia,
        attributes: ["url"],
        where: { tipo: "capa" },
        required: false,
      },
    ];

    // Ordenação padrão (aleatória quando não há filtros)
    let orderClause = [["dataInicio", "ASC"]];

    // Se não há filtros ativos, ordenar aleatoriamente
    if (
      !categoria &&
      preco === "qualquer" &&
      tipo === "qualquer" &&
      !localizacao
    ) {
      orderClause = [sequelize.fn("RAND")];
    }

    // Filtro por categoria (suporta múltiplas categorias)
    // Use | as separator to avoid splitting on category names with commas
    if (categoria && categoria !== "") {
      const categoriasArray = categoria.split("|").map(c => c.trim()).filter(c => c);
      whereClause.categoria = { [Op.in]: categoriasArray };
    }

    // Filtro por tipo (presencial/online)
    if (tipo && tipo !== "qualquer") {
      if (tipo === "online") {
        whereClause["$localizacao.endereco$"] = { [Op.is]: null };
      } else if (tipo === "presencial") {
        whereClause["$localizacao.endereco$"] = { [Op.not]: null };
      }
    }

    // Filtro por localização (busca parcial case-insensitive)
    if (localizacao && localizacao !== "") {
      whereClause["$localizacao.cidade$"] = {
        [Op.iLike]: `%${localizacao}%`,
      };
    }

    // Primeiro: contar total de eventos para paginação
    const totalEventos = await Evento.count({
      where: whereClause,
      include: includeClause.filter(
        (inc) => inc.model !== Ingresso && inc.model !== Midia
      ),
      distinct: true,
    });

    // Segundo: buscar eventos com limites
    const eventos = await Evento.findAll({
      where: whereClause,
      include: includeClause,
      order: orderClause,
      limit: parseInt(limite),
      offset: offset,
      subQuery: false,
    });

    // Filtro por preço (após buscar os eventos)
    let eventosFiltrados = eventos;
    if (preco && preco !== "qualquer") {
      eventosFiltrados = eventos.filter((evento) => {
        const temIngressos = evento.Ingressos && evento.Ingressos.length > 0;
        const temIngressoGratis =
          temIngressos &&
          evento.Ingressos.some((ingresso) => parseFloat(ingresso.preco) === 0);
        const temIngressoPago =
          temIngressos &&
          evento.Ingressos.some((ingresso) => parseFloat(ingresso.preco) > 0);

        if (preco === "gratis") {
          return temIngressoGratis || !temIngressos; // Considera eventos sem ingressos como gratuitos
        } else if (preco === "pago") {
          return temIngressoPago;
        }
        return true;
      });
    }

    res.status(200).json({
      eventos: eventosFiltrados,
      total: totalEventos,
      totalPaginas: Math.ceil(totalEventos / parseInt(limite)),
      paginaAtual: parseInt(pagina),
    });
  } catch (error) {
    console.error("Erro ao buscar eventos filtrados:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao buscar eventos",
      error: error.message,
    });
  }
});

app.get("/api/eventos/categorias", async (req, res) => {
  const categorias = [
    "Arte, Cultura e Lazer",
    "Congressos e Palestras",
    "Esporte",
    "Festas e Shows",
    "Gastronomia",
    "Games e Geek",
    "Grátis",
    "Infantil",
    "Moda e Beleza",
    "Teatros e Espetáculos",
  ];

  res.status(200).json(categorias);
});

app.get("/api/localizacoes", async (req, res) => {
  try {
    const localizacoes = await Localizacao.findAll({
      attributes: [
        [sequelize.fn("DISTINCT", sequelize.col("cidade")), "cidade"],
        "estado",
      ],
      where: {
        cidade: {
          [Op.ne]: null,
        },
      },
      order: [
        ["cidade", "ASC"],
        ["estado", "ASC"],
      ],
      limit: 50, // Limitar para não sobrecarregar
    });

    const cidadesFormatadas = localizacoes.map((loc) =>
      loc.estado ? `${loc.cidade}, ${loc.estado}` : loc.cidade
    );

    res.status(200).json(cidadesFormatadas);
  } catch (error) {
    console.error("Erro ao buscar localizações:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao buscar localizações",
    });
  }
});

app.get("/api/eventos/home", async (req, res) => {
  try {
    const { periodo, categoria, limite = 16 } = req.query;

    // Cláusula WHERE básica
    let whereClause = { statusEvento: "ativo" };

    // Cláusula INCLUDE para relacionamentos
    let includeClause = [
      {
        model: Localizacao,
        as: "localizacao",
        attributes: ["endereco", "cidade", "estado"],
      },
      {
        model: Organizador,
        as: "organizador",
        attributes: ["nome", "avatarUrl"],
      },
      {
        model: Ingresso,
        attributes: ["preco"],
        required: false,
      },
      {
        model: Midia,
        attributes: ["url", "tipo"],
        where: { tipo: "capa" },
        required: false,
      },
    ];

    // Filtro por categoria
    if (categoria && categoria !== "") {
      whereClause.categoria = categoria;
    }

    // Buscar eventos do banco
    let eventos = await Evento.findAll({
      where: whereClause,
      include: includeClause,
      order: [["dataInicio", "ASC"]],
      limit: parseInt(limite) || 16,
    });

    // Converter para JSON para manipulação
    eventos = eventos.map((evento) => evento.toJSON());

    // Aplicar filtro de período se especificado
    if (periodo) {
      eventos = filtrarPorPeriodo(eventos, periodo);
    }

    // Formatar dados para resposta
    const eventosFormatados = eventos.map((evento) => ({
      eventoId: evento.eventoId,
      nomeEvento: evento.nomeEvento,
      descEvento: evento.descEvento,
      dataInicio: evento.dataInicio,
      horaInicio: evento.horaInicio,
      localizacao: evento.localizacao,
      organizador: evento.organizador,
      Ingressos: evento.Ingressos,
      Midia: evento.Midia,
    }));

    res.status(200).json({
      success: true,
      eventos: eventosFormatados,
      total: eventosFormatados.length,
    });
  } catch (error) {
    console.error("Erro ao buscar eventos para home:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao buscar eventos",
      error:
        process.env.NODE_ENV === "development" ? error.message : "Erro interno",
    });
  }
});

app.get("/api/eventos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[BACKEND] Recebida requisição para o evento ID: ${id}`);

    const evento = await Evento.findByPk(id, {
      include: [
        {
          model: Localizacao,
          as: "localizacao",
          attributes: ["endereco", "cidade", "estado", "cep", "complemento"],
        },
        {
          model: Organizador,
          as: "organizador",
          attributes: ["organizadorId", "nome", "email", "avatarUrl"],
        },
        {
          model: Ingresso,
          attributes: [
            "ingressoId",
            "nome",
            "descricao",
            "preco",
            "quantidade",
            "dataLimite",
          ],
          required: false,
        },
        {
          model: Midia,
          attributes: ["midiaId", "url", "tipo"],
          required: false,
        },
      ],
    });

    if (!evento) {
      console.log(`[BACKEND] Evento com ID ${id} não encontrado.`);
      return res.status(404).json({
        success: false,
        message: "Evento não encontrado",
      });
    }

    console.log(
      `[BACKEND] Evento com ID ${id} encontrado. Enviando resposta...`
    );
    res.status(200).json({
      success: true,
      evento,
    });
  } catch (error) {
    console.error("[BACKEND] Erro ao buscar evento:", error);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
      error: error.message,
    });
  }
});

  // Rota pública para buscar organizador e seus eventos
  app.get('/organizadores/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const organizador = await Organizador.findByPk(id, {
        attributes: ['organizadorId', 'nome', 'email', 'avatarUrl'],
      });

      if (!organizador) {
        return res.status(404).json({ success: false, message: 'Organizador não encontrado' });
      }

      const eventos = await Evento.findAll({
        where: { organizadorId: id, statusEvento: 'ativo' },
        include: [
          { model: Localizacao, as: 'localizacao' },
          { model: Midia },
        ],
        order: [['dataInicio', 'ASC']],
      });

      res.json({ success: true, organizador: organizador.get({ plain: true }), eventos });
    } catch (error) {
      console.error('Erro ao buscar organizador:', error);
      res.status(500).json({ success: false, message: 'Erro ao buscar organizador' });
    }
  });


// CORREÇÃO: Buscar todos os campos exceto senha
app.put("/perfil/convidado", autenticar, async (req, res) => {
  try {
    if (req.tipoUsuario !== "convidado") {
      return res.status(403).json({
        success: false,
        message: "Acesso não autorizado",
      });
    }

    const {
      nome,
      sobreMim,
      telefone,
      dataNascimento,
      endereco,
      cidade,
      cep,
      senha,
      genero
    } = req.body;

    const camposParaAtualizar = {};

    if (nome !== undefined) camposParaAtualizar.nome = nome;
    if (sobreMim !== undefined) camposParaAtualizar.sobreMim = sobreMim;
    if (genero !== undefined) camposParaAtualizar.genero = genero;
    if (telefone !== undefined) camposParaAtualizar.telefone = telefone?.replace(/\D/g, "") || null;
    if (dataNascimento !== undefined) camposParaAtualizar.dataNascimento = dataNascimento;
    if (endereco !== undefined) camposParaAtualizar.endereco = endereco;
    if (cidade !== undefined) camposParaAtualizar.cidade = cidade;
    if (cep !== undefined) camposParaAtualizar.cep = cep?.replace(/\D/g, "") || null;

    if (senha && senha.trim() !== '') {
      camposParaAtualizar.senha = senha;
    }

    await Convidado.update(camposParaAtualizar, {
      where: { convidadoId: req.usuarioId }
    });
    const convidadoAtualizado = await Convidado.findByPk(req.usuarioId, {
      attributes: [
        'convidadoId', 'nome', 'email', 'cpf', 'telefone', 'genero',
        'dataNascimento', 'endereco', 'cidade', 'cep', 'avatarUrl', 'sobreMim'
      ]
    });

    res.json({
      success: true,
      message: "Perfil atualizado com sucesso",
      convidado: convidadoAtualizado 
    });
  } catch (error) {
    console.error("Erro ao atualizar perfil:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao atualizar perfil",
      error: error.message
    });
  }
});

app.put(
  "/perfil/convidado/foto",
  autenticar,
  upload.single("avatar"),
  async (req, res) => {
    try {
      if (req.tipoUsuario !== "convidado") {
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

      await Convidado.update(
        { avatarUrl },
        { where: { convidadoId: req.usuarioId } }
      );

      const convidado = await Convidado.findByPk(req.usuarioId, {
        attributes: ["convidadoId", "nome", "email", "avatarUrl", "sobreMim"]
      });

      res.json({
        success: true,
        message: "Foto atualizada com sucesso",
        avatarUrl,
        convidado: convidado 
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



app.post("/participar/evento/:ingressoId", autenticar, async (req, res) => {
  try {
    const { ingressoId } = req.params;

    if (req.tipoUsuario !== "convidado") {
      return res.status(403).json({
        success: false,
        message: "Apenas convidados podem participar de eventos desta forma.",
      });
    }

    const ingresso = await Ingresso.findByPk(ingressoId);
    if (!ingresso) {
      return res
        .status(404)
        .json({ success: false, message: "Ingresso não encontrado." });
    }

    const participacaoExistente = await Participacao.findOne({
      where: {
        convidadoId: req.usuarioId,
        ingressoId: ingressoId,
      },
    });

    if (participacaoExistente) {
      if (participacaoExistente.statusPagamento === 'Confirmado') {
        try {
          const quantidadeComprada = parseInt(req.body.quantidade || 1, 10) || 1;
          const valorTotal = (ingresso.preco || 0) * quantidadeComprada;

          const compra = await CompraIngresso.create({
            convidadoId: req.usuarioId,
            ingressoId: ingressoId,
            quantidade: quantidadeComprada,
            valorTotal,
            statusPagamento: 'confirmado'
          });

          return res.status(200).json({
            success: true,
            message: "Participação já confirmada. Compra registrada.",
            participacao: participacaoExistente,
            compra
          });
        } catch (err) {
          console.warn('Falha ao registrar compra adicional:', err.message || err);
          return res.status(200).json({
            success: true,
            message: "Participação já confirmada.",
            participacao: participacaoExistente,
          });
        }
      }
    }

    const codigoTransacao = `TRANS-${Date.now()}-${req.usuarioId}`;

    const novaParticipacao = await Participacao.create({
      convidadoId: req.usuarioId,
      ingressoId: ingressoId,
      statusPagamento: 'Confirmado', 
      codigoTransacao: codigoTransacao,
    });

    try {
      const quantidadeComprada = parseInt(req.body.quantidade || 1, 10) || 1;
      const valorTotal = (ingresso.preco || 0) * quantidadeComprada;

      const compra = await CompraIngresso.create({
        convidadoId: req.usuarioId,
        ingressoId: ingressoId,
        quantidade: quantidadeComprada,
        valorTotal,
        statusPagamento: 'confirmado'
      });

      // Anexar compra à resposta
      novaParticipacao.dataValues.compra = compra;
    } catch (err) {
      console.warn('Falha ao criar registro CompraIngresso:', err.message || err);
    }

    res.status(201).json({
      success: true,
      message: "Participação confirmada com sucesso (Simulação de Pagamento).",
      participacao: novaParticipacao,
      // Retorna o eventoId para a próxima chamada de adesão ao grupo
      eventoId: ingresso.eventoId,
    });

  } catch (error) {
    console.error("Erro ao registrar participação:", error);
    res.status(500).json({
      success: false,
      message: "Erro interno ao registrar participação.",
      error: error.message,
    });
  }
});
// ROTA GET PARA STATUS DE PARTICIPAÇÃO (MANTIDA)
app.get("/participacao/evento/:eventoId", autenticar, async (req, res) => {
  try {
    const { eventoId } = req.params;

    if (req.tipoUsuario !== "convidado") {
      return res.status(200).json({ status: "Não Aplicável" });
    }

    // Busca ingressos relacionados ao evento
    const ingressosEvento = await Ingresso.findAll({
      where: { eventoId },
      attributes: ['ingressoId']
    });
    const ingressoIds = ingressosEvento.map(ing => ing.ingressoId);

    if (ingressoIds.length === 0) {
      return res.status(200).json({ status: "Não Participa" });
    }

    // Busca a participação do convidado para qualquer um desses ingressos
    const participacao = await Participacao.findOne({
      where: {
        convidadoId: req.usuarioId,
        ingressoId: {
          [Op.in]: ingressoIds
        },
        statusPagamento: 'Confirmado'
      },
      order: [['createdAt', 'DESC']]
    });

    const status = participacao ? 'Participa' : 'Não Participa';

    res.status(200).json({ status });
  } catch (error) {
    console.error("Erro ao buscar status de participação:", error);
    res.status(500).json({ success: false, message: "Erro interno" });
  }
});

// FUNÇÃO AUXILIAR PARA VERIFICAR SE É CONVIDADO
const verifyConvidadoMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).send("Acesso negado: Token ausente.");
    }

    const usuario = await verificarToken(token);

    if (!usuario || !(usuario instanceof Convidado)) {
      return res.status(403).send("Acesso negado: Somente convidados.");
    }

    req.usuario = usuario;
    req.usuarioId = usuario.convidadoId;
    next();
  } catch (error) {
    return res.status(401).send("Acesso negado: Token inválido.");
  }
};


// NOVA ROTA POST: ADERIR AO GRUPO APÓS COMPRA
app.post("/grupos/aderir", verifyConvidadoMiddleware, async (req, res) => {
  const { eventoId } = req.body;
  const convidadoId = req.usuarioId;

  try {
    // 1. Encontrar o grupo associado ao evento
    const grupo = await Grupo.findOne({
      where: { eventoId, tipo: 'evento' },
      attributes: ['grupoId', 'nome']
    });

    if (!grupo) {
      return res.status(404).json({ message: "Grupo de chat não encontrado para este evento." });
    }

    // 2. Verificar se o convidado já é membro
    const membroExistente = await MembrosGrupo.findOne({
      where: {
        grupoId: grupo.grupoId,
        convidadoId: convidadoId,
      },
    });

    if (membroExistente) {
      return res.status(200).json({
        message: "Convidado já é membro do grupo.",
        grupoId: grupo.grupoId
      });
    }

    // 3. Adicionar o convidado como membro
    await MembrosGrupo.create({
      grupoId: grupo.grupoId,
      convidadoId: convidadoId,
    });

    res.status(201).json({
      message: "Convidado adicionado ao grupo com sucesso!",
      grupoId: grupo.grupoId,
      grupoNome: grupo.nome
    });

  } catch (error) {
    console.error("Erro ao aderir ao grupo:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
});


// NOVA ROTA GET: LISTAR GRUPOS DO CONVIDADO LOGADO
app.get("/grupos/convidado", verifyConvidadoMiddleware, async (req, res) => {
  const convidadoId = req.usuarioId;

  try {
    // Busca as associações de membro do convidado
    const membros = await MembrosGrupo.findAll({
      where: { convidadoId },
      include: [{
        model: Grupo,
        as: 'grupo',
        attributes: ['grupoId', 'nome', 'descricao', 'eventoId'],
        // Inclui o nome do Evento associado
        include: [{
          model: Evento,
          as: 'evento',
          attributes: ['nomeEvento']
        }]
      }],
    });

    // Formata o resultado para enviar apenas os dados do grupo
    const gruposFormatados = membros.map(membro => ({
      grupoId: membro.grupo.grupoId,
      nome: membro.grupo.nome,
      descricao: membro.grupo.descricao,
      eventoNome: membro.grupo.evento ? membro.grupo.evento.nomeEvento : 'Evento Removido'
    }));

    res.json({ success: true, grupos: gruposFormatados });

  } catch (error) {
    console.error("Erro ao buscar grupos do convidado:", error);
    res.status(500).json({ success: false, message: "Erro interno do servidor." });
  }
});


// ROTA ANTIGA /grupos CORRIGIDA (AGORA SOMENTE ORGANIZADOR)
app.get("/grupos/organizador", autenticar, async (req, res) => {
  try {
    if (req.tipoUsuario !== "organizador") {
      return res.status(403).json({ success: false, message: "Acesso negado." });
    }

    console.log("Buscando grupos criados pelo organizador");
    const grupos = await Grupo.findAll({
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

http.listen(PORT, () => {
  console.log(`Servidor rodando com Socket.IO na porta: ${PORT}`);
});


 
async function seedEvents() {
  try {
    let organizador1 = await Organizador.findOne();
    let organizador2 = await Organizador.findOne();
    let organizador3 = await Organizador.findOne();
    let organizador4 = await Organizador.findOne();
    let organizador5 = await Organizador.findOne();
    let organizador6 = await Organizador.findOne();
    let organizador7 = await Organizador.findOne();
    let organizador8 = await Organizador.findOne();
    let organizador9 = await Organizador.findOne();
    let organizador10 = await Organizador.findOne();


    if (!organizador1) {
      organizador1 = await Organizador.create({
        nome: "Jorge",
        email: "jorge@gmail.com",
        senha: "1234",
        avatarUrl: "/uploads/org1/foto.jpg",
      });
      organizador2 = await Organizador.create({
        nome: "Yas",
        email: "yas@gmail.com",
        senha: "1234",
        avatarUrl: "/uploads/org1/yas.jpg",
      });

      organizador3 = await Organizador.create({
        nome: "Rafael",
        email: "rafael@gmail.com",
        senha: "1234",
        avatarUrl: "/uploads/org1/rafael.jpg",
      });

      organizador4 = await Organizador.create({
        nome: "Leandro",
        email: "leandro@gmail.com",
        senha: "1234",
        avatarUrl: "/uploads/org1/leandro.jpg",
      });
      organizador5 = await Organizador.create({
        nome: "Cayo",
        email: "cayo@gmail.com",
        senha: "1234",
        avatarUrl: "/uploads/org1/sonic.jpg",
      });
      organizador6 = await Organizador.create({
        nome: "Leonardo",
        email: "leonardo@gmail.com",
        senha: "1234",
        avatarUrl: "/uploads/org1/leonardo.jpg",

      });
      organizador7 = await Organizador.create({
        nome: "Nathalia",
        email: "nathalia@gmail.com",
        senha: "1234",
        avatarUrl: "/uploads/org1/nath.jpg",

      });
      organizador8 = await Organizador.create({
        nome: "BomBom",
        email: "bombom@gmail.com",
        senha: "1234",
        avatarUrl: "/uploads/org1/bombom.jpg",
      });
      organizador9 = await Organizador.create({
        nome: "Matheus",
        email: "matheus@gmail.com",
        senha: "1234",
        avatarUrl: "/uploads/org1/matheus.jpg",

      });
    }

    let convidado1 = await Convidado.findOne();

  if (!convidado1) {
  convidado1 = await Convidado.create({
    nome: "Rafael",
    cpf: "123.456.789-00",
    email: "teste@gmail.com",
    senha: "123456",
    telefone: "(11) 91234-5678",
    genero: "Masculino",
    dataNascimento: "2000-01-01",
    endereco: "Rua das Flores, 123",
    cidade: "Guarulhos",
    cep: "07000-000",
    sobreMim: "Apenas um convidado de teste.",
  });
  }

   // Criar localizações
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

   const eventos = await Evento.bulkCreate([
  {
    nomeEvento: "Evento de Futebol",
    descEvento: "Um incrível festival com os melhores clubes nacionais e internacionais",
    categoria: "Esporte",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[2].localizacaoId,
    organizadorId: organizador1.organizadorId,
  },
  {
    nomeEvento: "Evento Surf",
    descEvento: "Um incrível festival de surf melhores atletas nacionais e internacionais",
    categoria: "Esporte",
    privacidadeEvento: "Público",
    dataInicio: "2024-11-15",
    horaInicio: "16:00:00",
    dataFim: "2024-11-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[2].localizacaoId,
    organizadorId: organizador1.organizadorId,
  },
  {
    nomeEvento: "Evento de Corrida",
    descEvento: "Um incrível festival com os melhores corredores nacionais e internacionais",
    categoria: "Esporte",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[2].localizacaoId,
    organizadorId: organizador1.organizadorId,
  },  
  {
    nomeEvento: "Evento de Vôlei ",
    descEvento: "Um incrível jog de Vôlei com os melhores clubes nacionais e internacionais",
    categoria: "Esporte",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[2].localizacaoId,
    organizadorId: organizador1.organizadorId,
  },

  {
    nomeEvento: "Evento de Basquete",
    descEvento: "Um incrível jogo de basquete com os melhores clubes nacionais e internacionais",
    categoria: "Esporte",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[2].localizacaoId,
    organizadorId: organizador1.organizadorId,
  },

  {
    nomeEvento: "Show Linkin Park",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Festas e Shows",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[0].localizacaoId,
    organizadorId: organizador2.organizadorId,
  },
  {
    nomeEvento: "Show Luan Santana",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Festas e Shows",
    privacidadeEvento: "Público",
    dataInicio: "2024-11-15",
    horaInicio: "16:00:00",
    dataFim: "2024-11-16",
    horaFim: "02:00:00",
    statusEvento: "ativo",
    localizacaoId: localizacoes[0].localizacaoId,
    organizadorId: organizador2.organizadorId,
  },
  {
    nomeEvento: "Festival Michael Jackson",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Festas e Shows",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[0].localizacaoId,
    organizadorId: organizador2.organizadorId,
  },  
  {
    nomeEvento: "Show Xuxa ",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Festas e Shows",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[0].localizacaoId,
    organizadorId: organizador2.organizadorId,
  },

  {
    nomeEvento: "Show Ozzy Osbourne",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Festas e Shows",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[0].localizacaoId,
    organizadorId: organizador2.organizadorId,
  },

  {
    nomeEvento: "Master Chefe",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Gastronomia",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[1].localizacaoId,
    organizadorId: organizador3.organizadorId,
  },
  {
    nomeEvento: "Festival Comida Coreana",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Gastronomia",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[1].localizacaoId,
    organizadorId: organizador3.organizadorId,
  },  
  {
    nomeEvento: "Festa Junina",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Gastronomia",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo",
    localizacaoId: localizacoes[1].localizacaoId,
    organizadorId: organizador3.organizadorId,
  },

    {
    nomeEvento: "Festa Achiropita ",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Gastronomia",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[1].localizacaoId,
    organizadorId: organizador3.organizadorId,
  },

  {
    nomeEvento: "Bon Odori - Gastronomia Japonesa ",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Gastronomia",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo",
    localizacaoId: localizacoes[1].localizacaoId,
    organizadorId: organizador3.organizadorId,
  },
  
  {
    nomeEvento: "Desfile de Moda",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Moda e Beleza",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo",
    localizacaoId: localizacoes[1].localizacaoId,
    organizadorId: organizador4.organizadorId,
  },
  
  {
    nomeEvento: "Ensaio Fotografico Gratuito",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Moda e Beleza",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[1].localizacaoId,
    organizadorId: organizador4.organizadorId,
  },
  {
    nomeEvento: "Baile Sephora",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Moda e Beleza",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[1].localizacaoId,
    organizadorId: organizador4.organizadorId,
  },
  {
    nomeEvento: "Victoria's Secret",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Moda e Beleza",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[1].localizacaoId,
    organizadorId: organizador4.organizadorId,
  },

  {
    nomeEvento: "Fashion Week - London",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Moda e Beleza",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[1].localizacaoId,
    organizadorId: organizador4.organizadorId,
  },
  {
    nomeEvento: "Evento na Disney",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Infantil",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[1].localizacaoId,
    organizadorId: organizador5.organizadorId,
  },
  {
    nomeEvento: "Encontro com o Patati e o Patata",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Infantil",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[1].localizacaoId,
    organizadorId: organizador5.organizadorId,
  },  
  {
    nomeEvento: "Festa de Aniversário do Sonic",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Infantil",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[1].localizacaoId,
    organizadorId: organizador5.organizadorId,
  },
  {
    nomeEvento: "Festa Shrek No Pantano",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Infantil",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[1].localizacaoId,
    organizadorId: organizador5.organizadorId,
  },
  
  {
    nomeEvento: "Versão Infantojuvenil - Debate Político Social Sobre a Situação do Brasi",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Infantil",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[1].localizacaoId,
    organizadorId: organizador5.organizadorId,
  },
  {
    nomeEvento: "CCXP",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Games e Geek",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[1].localizacaoId,
    organizadorId: organizador6.organizadorId,
  },
  {
    nomeEvento: "Expo",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Games e Geek",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[1].localizacaoId,
    organizadorId: organizador6.organizadorId,
  },
  {
    nomeEvento: "Feira Geek",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Games e Geek",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[1].localizacaoId,
    organizadorId: organizador6.organizadorId,
  },
  {
    nomeEvento: "Anime Friends",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Games e Geek",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[1].localizacaoId,
    organizadorId: organizador6.organizadorId,
  },
  {
    nomeEvento: "SwordPlay",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Games e Geek",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[1].localizacaoId,
    organizadorId: organizador6.organizadorId,
  },  
  {
    nomeEvento: "Visita Farol Santander",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Arte, Cultura e Lazer",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[0].localizacaoId,
    organizadorId: organizador7.organizadorId,
  },  
  {
    nomeEvento: "Visita Museu da Língua Portuguesa",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Arte, Cultura e Lazer",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[0].localizacaoId,
    organizadorId: organizador7.organizadorId,
  },
  {
    nomeEvento: "Exposição MASP",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Arte, Cultura e Lazer",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[0].localizacaoId,
    organizadorId: organizador7.organizadorId,
  },
  {
    nomeEvento: "Virada Cultural",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Arte, Cultura e Lazer",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[0].localizacaoId,
    organizadorId: organizador7.organizadorId,
  },
  {
    nomeEvento: "Encontro de Yoga No Ibirapuera",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Arte, Cultura e Lazer",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[0].localizacaoId,
    organizadorId: organizador7.organizadorId,
  },
  {
    nomeEvento: "Opéra Nice Côte d'Azur",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Teatros e Espetáculos",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[0].localizacaoId,
    organizadorId: organizador8.organizadorId,
  },
  {
    nomeEvento: "Concerto Hilda Furacão",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Teatros e Espetáculos",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[0].localizacaoId,
    organizadorId: organizador8.organizadorId,
  },
  {
    nomeEvento: "Apresentação O Fantasma da Ópera",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Teatros e Espetáculos",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[0].localizacaoId,
    organizadorId: organizador8.organizadorId,
  },
  {
    nomeEvento: "Orquestra Sinfônica",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Teatros e Espetáculos",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[0].localizacaoId,
    organizadorId: organizador8.organizadorId,
  },
  {
    nomeEvento: "Visita Theatro Municipal de SP",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Teatros e Espetáculos",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[0].localizacaoId,
    organizadorId: organizador8.organizadorId,
  },
  {
    nomeEvento: "Palestra OAB",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Congressos e Palestras",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[0].localizacaoId,
    organizadorId: organizador9.organizadorId,
  },
  {
    nomeEvento: "Palestra Médico Obstetricista",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Congressos e Palestras",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[0].localizacaoId,
    organizadorId: organizador9.organizadorId,
  },
  {
    nomeEvento: "Congresso Odontologia",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Congressos e Palestras",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[0].localizacaoId,
    organizadorId: organizador9.organizadorId,
  },
  {
    nomeEvento: "Palestra - Prevenção do HPV",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Congressos e Palestras",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[0].localizacaoId,
    organizadorId: organizador9.organizadorId,
  },
  {
    nomeEvento: "Congresso AIDA",
    descEvento: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
    categoria: "Congressos e Palestras",
    privacidadeEvento: "Público",
    dataInicio: "2024-12-15",
    horaInicio: "16:00:00",
    dataFim: "2024-12-16",
    horaFim: "02:00:00",
    statusEvento: "ativo", 
    localizacaoId: localizacoes[0].localizacaoId,
    organizadorId: organizador9.organizadorId,
  },

]);
    await Midia.bulkCreate([
      {
        eventoId: eventos[0].eventoId,
        url: "/uploads/org1/esporte1.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[1].eventoId,
        url: "/uploads/org1/esporte2.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[2].eventoId,
        url: "/uploads/org1/esporte3.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[3].eventoId,
        url: "/uploads/org1/esporte4.webp",
        tipo: "capa",
      },
      {
        eventoId: eventos[4].eventoId,
        url: "/uploads/org1/galeriabasquete1.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[5].eventoId,
        url: "/uploads/org2/show1.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[6].eventoId,
        url: "/uploads/org2/show2.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[7].eventoId,
        url: "/uploads/org2/jack3.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[8].eventoId,
        url: "/uploads/org2/show4.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[9].eventoId,
        url: "/uploads/org2/show5.jpg",
        tipo: "capa",
      },

      {
        eventoId: eventos[10].eventoId,
        url: "/uploads/org3/gastronomia1.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[11].eventoId,
        url: "/uploads/org3/gastronomia2.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[12].eventoId,
        url: "/uploads/org3/gastronomia3.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[13].eventoId,
        url: "/uploads/org3/achi.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[14].eventoId,
        url: "/uploads/org3/jap.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[15].eventoId,
        url: "/uploads/org4/desfile1.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[16].eventoId,
        url: "/uploads/org4/foto1.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[17].eventoId,
        url: "/uploads/org4/baile.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[18].eventoId,
        url: "/uploads/org4/adri.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[19].eventoId,
        url: "/uploads/org4/week.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[20].eventoId,
        url: "/uploads/org5/ney1.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[21].eventoId,
        url: "/uploads/org5/pat1.jpg",
        tipo: "capa",
      }, 
      {
        eventoId: eventos[22].eventoId,
        url: "/uploads/org5/sonic1.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[23].eventoId,
        url: "/uploads/org5/pantano.jpg",
        tipo: "capa",
      },          
      {
        eventoId: eventos[24].eventoId,
        url: "/uploads/org5/mini.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[25].eventoId,
        url: "/uploads/org6/ccxp.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[26].eventoId,
        url: "/uploads/org6/expo.jpg",
        tipo: "capa",
      },      
      {
        eventoId: eventos[27].eventoId,
        url: "/uploads/org6/feira.jpg",
        tipo: "capa",
      },      
      {
        eventoId: eventos[28].eventoId,
        url: "/uploads/org6/friends.jpg",
        tipo: "capa",
      },      
      {
        eventoId: eventos[29].eventoId,
        url: "/uploads/org6/play.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[30].eventoId,
        url: "/uploads/org7/farol.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[31].eventoId,
        url: "/uploads/org7/lp.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[32].eventoId,
        url: "/uploads/org7/masp.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[33].eventoId,
        url: "/uploads/org7/virada.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[34].eventoId,
        url: "/uploads/org7/yoga.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[35].eventoId,
        url: "/uploads/org8/ballet.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[36].eventoId,
        url: "/uploads/org8/concertohil.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[37].eventoId,
        url: "/uploads/org8/fantasma.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[38].eventoId,
        url: "/uploads/org8/orquestra.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[39].eventoId,
        url: "/uploads/org8/theatro.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[40].eventoId,
        url: "/uploads/org9/adv.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[41].eventoId,
        url: "/uploads/org9/medico.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[42].eventoId,
        url: "/uploads/org9/odonto.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[43].eventoId,
        url: "/uploads/org9/palestra.jpg",
        tipo: "capa",
      },
      {
        eventoId: eventos[44].eventoId,
        url: "/uploads/org9/sii.jpg",
        tipo: "capa",
      },
    ]);


    await Ingresso.bulkCreate([
      {
        eventoId: eventos[0].eventoId,
        nome: "Pista",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 150.0,
        quantidade: 5000,
        dataLimite: "2024-02-14",
      },
      {
        eventoId: eventos[0].eventoId,
        nome: "VIP",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 350.0,
        quantidade: 1000,
        dataLimite: "2024-02-14",
      },
      {
        eventoId: eventos[1].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 200.0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[1].eventoId,
        nome: "Pista",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 150.0,
        quantidade: 5000,
        dataLimite: "2024-02-14",
      },
      {
        eventoId: eventos[1].eventoId,
        nome: "VIP",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 350.0,
        quantidade: 1000,
        dataLimite: "2024-02-14",
      },
      {
        eventoId: eventos[1].eventoId,
        nome: "Pista",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 150.0,
        quantidade: 5000,
        dataLimite: "2024-02-14",
      },
      {
        eventoId: eventos[2].eventoId,
        nome: "VIP",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 350.0,
        quantidade: 1000,
        dataLimite: "2024-02-14",
      },
      {
        eventoId: eventos[3].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 200.0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
       {
        eventoId: eventos[4].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 200.0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[6].eventoId,
        nome: "Pista",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 150.0,
        quantidade: 5000,
        dataLimite: "2024-02-14",
      },
      {
        eventoId: eventos[7].eventoId,
        nome: "VIP",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 350.0,
        quantidade: 1000,
        dataLimite: "2024-02-14",
      },
      {
        eventoId: eventos[8].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 200.0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
       {
        eventoId: eventos[9].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 200.0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[10].eventoId,
        nome: "VIP",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 350.0,
        quantidade: 1000,
        dataLimite: "2024-02-14",
      },
      {
        eventoId: eventos[11].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 200.0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
       {
        eventoId: eventos[12].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 200.0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[13].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 200.0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },       
      {
        eventoId: eventos[13].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 200.0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[14].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 200.0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[15].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[16].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[17].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[18].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[19].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[20].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[21].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[22].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[23].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[24].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[25].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[26].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[27].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[28].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[29].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[30].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[31].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[32].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 300.0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[33].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[34].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[35].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 1000.0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[36].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 1000.0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[37].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 1000.0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[38].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 1000.0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[39].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[40].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[41].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 200.0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[42].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 400.0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[43].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 200.0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
      {
        eventoId: eventos[44].eventoId,
        nome: "Participante",
        descricao: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pulvinar, eros a placerat.",
        preco: 700.0,
        quantidade: 20,
        dataLimite: "2024-03-08",
      },
    ]);

    console.log("Eventos criados com sucesso!");
    console.log(
      `Foram criados ${eventos.length} eventos com a imagem fornecida.`
    );
  } catch (error) {
    console.error("Erro ao criar eventos:", error);
  } finally {
  }
}

sequelize
  .sync({ force: true })
  .then(async () => {
    console.log("Modelos sincronizados com o banco de dados");
    try {
      await seedEvents();
      console.log("Seed concluído");
    } catch (err) {
      console.error("Erro durante seedEvents:", err);
    }
  })
  .catch((err) => {
    console.error("Erro ao sincronizar modelos:", err);
  });