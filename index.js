require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const sequelize = require("./db");
const jwt = require("jsonwebtoken");

const Organizador = require("./models/Organizador");
const Evento = require("./models/Evento");
const Localizacao = require("./models/Localizacao");
const Midia = require("./models/Midia");
const Ingresso = require("./models/Ingresso");
const Convidado = require("./models/Convidado");

app.use(cors());
app.use(express.json());
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

    console.log("Localização criada:", localizacaoCriada.localizacaoId);

    const evento = await Evento.create({
      nomeEvento: nome,
      descEvento: descricao,
      tipoEvento: tipo,
      privacidadeEvento: privacidade,
      dataInicio: dataInicio,
      dataFim: dataFim,
      localizacaoId: localizacaoCriada.localizacaoId,
      statusEvento: status,
      organizadorId: req.usuarioId,
    });

    if (fotos && fotos.galeria) {
      await Promise.all(
        fotos.galeria.map((url) =>
          Midia.create({
            eventoId: evento.eventoId,
            tipo: "imagem",
            url: url,
          })
        )
      );
    }

    if (ingressos && ingressos.length > 0) {
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
        {
          model: Localizacao,
        },
        {
          model: Organizador,
          attributes: ["nome"],
        },
      ],
      order: [["dataInicio", "ASC"]],
    });

    res.status(200).json(eventos);
  } catch (error) {
    console.error("Erro ao buscar eventos:", error);
    res.status(500).json({ message: "Erro ao buscar eventos" });
  }
});


//parte cliente
app.post("/cadastro/convidado", async (req, res) => {
  console.log("Requisição recebida no backend:", req.body);

  try {
    const { cpf, email } = req.body;

    if (!cpf || !email) {
      return res.status(400).json({
        success: false,
        message: "CPF e email são obrigatórios",
      });
    }

    const cpfExistente = await Convidado.findOne({
      where: { cpf: cpf.replace(/\D/g, "") },
    });
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
    const novoConvidado = await Convidado.create({
      nome: req.body.nome,
      cpf: req.body.cpf.replace(/\D/g, ""),
      email: req.body.email,
      senha: req.body.senha,
      telefone: req.body.telefone.replace(/\D/g, ""),
      genero: req.body.genero,
      dataNascimento: req.body.dataNascimento,
      endereco: req.body.endereco,
      cidade: req.body.cidade,
      cep: req.body.cep.replace(/\D/g, ""),
    });
    const convidadoResponse = novoConvidado.toJSON();
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

    if (!convidado) {
      return res.status(401).json({
        success: false,
        message: "E-mail não cadastrado",
      });
    }

    if (convidado.senha !== senha) {
      return res.status(401).json({
        success: false,
        message: "Senha incorreta",
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

sequelize
  .sync({ force: false })
  .then(() => {
    console.log("Modelos sincronizados com o banco de dados");
    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta: ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Erro ao sincronizar modelos:", err);
  });
