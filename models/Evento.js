const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Evento = sequelize.define(
  "Evento",
  {
    eventoId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    localizacaoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Localizacao",
        key: "localizacaoId",
      },
    },
    organizadorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Organizador",
        key: "organizadorId",
      },
    },
    nomeEvento: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    descEvento: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    tipoEvento: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "Outro",
    },
    privacidadeEvento: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "Público",
    },
    dataInicio: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    horaInicio: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    dataFim: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    horaFim: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    statusEvento: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    categoria: {
      type: DataTypes.ENUM(
        "Arte, Cultura e Lazer",
        "Congressos e Palestras",
        "Cursos e Workshops",
        "Esporte",
        "Festas e Shows",
        "Gastronomia",
        "Games e Geek",
        "Grátis",
        "Infantil",
        "Moda e Beleza",
        "Passeios e Tours",
        "Religião e Espiritualidade",
        "Saúde e Bem-Estar",
        "Teatros e Espetáculos"
      ),
    },
  },
  {
    tableName: "Evento",
    timestamps: true,
  }
);

module.exports = Evento;

const Organizador = require("./Organizador");
const Localizacao = require("./Localizacao");

Evento.belongsTo(Organizador, {
  foreignKey: "organizadorId",
  as: "organizador",
});

Evento.belongsTo(Localizacao, {
  foreignKey: "localizacaoId",
  as: "localizacao",
});
Evento.associate = function (models) {
  Evento.hasMany(models.Grupo, {
    foreignKey: "eventoId",
    as: "grupos",
  });
};
