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
    },
    genero: {
      type: DataTypes.STRING(20),
    },
    dataNascimento: {
      type: DataTypes.DATEONLY,
    },
    endereco: {
      type: DataTypes.STRING(200),
    },
    cidade: {
      type: DataTypes.STRING(100),
    },
    cep: {
      type: DataTypes.STRING(9),
    },
    avatarUrl: {
      type: DataTypes.STRING(500),
    },

    sobreMim: { type: DataTypes.STRING(500) },
  },
  {
    tableName: "Convidado",
    timestamps: false,
  }
);

module.exports = Convidado;
const CompraIngresso = require("./CompraIngresso");

Convidado.hasMany(CompraIngresso, {
    foreignKey: "convidadoId",
    as: "ComprasIngresso",
});

