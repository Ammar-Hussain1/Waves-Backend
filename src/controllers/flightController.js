import { sql, poolPromise } from '../config/db.js';
import dotenv from 'dotenv';
dotenv.config();

export const getAllFlights = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query("SELECT * FROM Flights");
        res.json(result.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};