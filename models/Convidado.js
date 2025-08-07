const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Convidado = sequelize.define(
  "Convidado",
  {
    convidadoId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    nome: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    cpf: {
      type: DataTypes.STRING(14),
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    senha: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    telefone: {
      type: DataTypes.STRING(15),
      allowNull: false,
    },
    genero: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    dataNascimento: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    endereco: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    cidade: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    cep: {
      type: DataTypes.STRING(9),
      allowNull: false,
    },
  },
  {
    tableName: "Convidado",
    timestamps: false,
  }
);

sequelize.sync();
module.exports = Convidado;
