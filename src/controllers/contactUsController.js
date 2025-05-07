import { sql, poolPromise } from '../config/db.js';
import dotenv from 'dotenv';
dotenv.config();

export const getAllContactUs = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query("SELECT * FROM UserContact");
        res.json(result.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const insertContactUs = async (req, res) => {
    try {
        const { UName, Email, Phone, UMessage } = req.body;

        if (!UName || !Email || !Phone || !UMessage) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        const pool = await poolPromise;

        await pool.request()
            .input('UName', sql.NVarChar, UName)
            .input('Email', sql.NVarChar, Email)
            .input('Phone', sql.NVarChar, Phone)
            .input('UMessage', sql.NVarChar, UMessage)
            .query(`
                INSERT INTO UserContact (UName, Email, Phone, UMessage)
                VALUES (@UName, @Email, @Phone, @UMessage)
            `);

        res.status(201).json({ message: 'Contact message submitted successfully.' });

    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

export const updateContactSeen = async (req, res) => {
    try {
        const { contactId } = req.params;

        if (!contactId) {
            return res.status(400).json({ message: 'Contact ID is required.' });
        }

        const pool = await poolPromise;

        const result = await pool.request()
            .input('Id', sql.Int, contactId)
            .query(`
                UPDATE UserContact
                SET Seen = 1
                WHERE UserContactId = @Id
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'Message not found or already marked as seen.' });
        }

        res.status(200).json({ message: 'Contact message marked as seen.' });

    } catch (err) {
        console.error('Error updating Seen status:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};