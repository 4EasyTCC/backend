const { DataTypes } = require("sequelize");
const sequelize = require("../db");
const Localizacao = require("./Localizacao");
const Organizador = require("./Organizador");

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
  },
  {
    tableName: "Evento",
    timestamps: true,
  }
);

Evento.belongsTo(Localizacao, {
  foreignKey: {
    name: "localizacaoId",
  },
});
Localizacao.hasMany(Evento, {
  foreignKey: "localizacaoId",
});

Evento.belongsTo(Organizador, { foreignKey: "organizadorId" });

module.exports = Evento;
