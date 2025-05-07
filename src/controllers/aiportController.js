import { sql, poolPromise } from '../config/db.js';
import dotenv from 'dotenv';
dotenv.config();

export const getAllAirports = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query("SELECT * FROM Airports");
        res.json(result.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};