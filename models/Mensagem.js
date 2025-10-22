const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Mensagem = sequelize.define(
  "Mensagem",
  {
    mensagemId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    texto: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    tipo: {
      type: DataTypes.STRING,
      defaultValue: "texto",
    },
    usuarioId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    tipoUsuario: {
      type: DataTypes.STRING, 
      allowNull: false,
    },
    grupoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Grupo",
        key: "grupoId",
      },
    },
  },
  {
    tableName: "Mensagem",
    timestamps: true,
  }
);

module.exports = Mensagem;

const Organizador = require("./Organizador");
const Grupo = require("./Grupo");

Mensagem.belongsTo(Organizador, {
  foreignKey: "usuarioId",
  as: "organizador",
});

Mensagem.belongsTo(Grupo, {
  foreignKey: "grupoId",
  as: "grupo",
});
