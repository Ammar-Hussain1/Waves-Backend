import { sql, poolPromise } from '../config/db.js';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
dotenv.config();


export const registerUser = async (req, res) => {
    const { name, email, password, usertype } = req.body;
  
    try {
      const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_KEY));
      const pool = await poolPromise;
      await pool.request()
        .input('FullName', sql.NVarChar, name)
        .input('email', sql.NVarChar, email)
        .input('passwordhash', sql.NVarChar, hashedPassword)
        .input('UserType', sql.NVarChar, usertype)
        .query('INSERT INTO Users (email, passwordhash, fullname, usertype) VALUES (@email, @passwordhash, @FullName, @UserType)');
  
      res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
};

export const getAllUsers = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query("SELECT * FROM Users");
        res.json(result.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getUserById = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input("UserID", sql.VarChar, req.params.id)
            .query("SELECT * FROM Users WHERE UserID = @UserID");
        
        if (result.recordset.length === 0) return res.status(404).json({ message: "User not found" });

        res.json(result.recordset[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input("UserID", sql.VarChar, req.params.id)
            .query("DELETE FROM Users WHERE UserID = @UserID");
        
        res.json({ message: "User deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
