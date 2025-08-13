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
    conteudo: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    tipo: {
      type: DataTypes.STRING, //texto imagem audoo
      defaultValue: "texto",
    },
    remetenteId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    remetenteTipo: {
      type: DataTypes.STRING, 
      allowNull: false,
    },
    grupoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    urlArquivo: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "Mensagem",
    timestamps: true,
  }
);

module.exports = Mensagem;
