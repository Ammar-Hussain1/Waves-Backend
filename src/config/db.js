import sql from "mssql";
import dotenv from "dotenv";
dotenv.config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT),
    options: {
        encrypt: true,
        trustServerCertificate: true,
    },
};
const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
        console.log("Connected to SQL Server");
        return pool;
    })
    .catch(err => {
        console.error("Database connection failed:", err);
        throw err;
    });

export {
    sql,
    poolPromise,
};
