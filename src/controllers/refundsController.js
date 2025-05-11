import { sql, poolPromise } from '../config/db.js';
import dotenv from 'dotenv';
dotenv.config();

export const getAllRefunds = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query("SELECT * FROM Refunds");
        res.json(result.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getAllProcessingRefunds = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query("SELECT * FROM Refunds WHERE RefundStatus = 'Processing'");
        res.json(result.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getAllRejectedRefunds = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query("SELECT * FROM Refunds WHERE RefundStatus = 'Rejected'");
        res.json(result.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getAllCompletedRefunds = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query("SELECT * FROM Refunds WHERE RefundStatus = 'Completed'");
        res.json(result.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const createRefund = async (req, res) => {
    try {
        const {BookingID, Reason} = req.body;
        const pool = await poolPromise;
        const result = await pool.request()
        .input('bookingID', sql.Int, BookingID)
        .input('reason', sql.NVarChar, Reason)
        .query(`
            DECLARE @RefundAmount;
            
            SELECT @RefundAmount = FC.Price FROM Bookings B 
            INNER JOIN FlightClasses FC
                ON FC.FlightID = B.FlightID
            WHERE B.SeatClass = FC.ClassID;

            INSERT INTO Refunds(BookingID, Reason, RefundAmount)
            VALUES (@bookingID, @reason, @RefundAmount);
            `);
        res.json(result.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const updateRefundStatus = async (req, res) => {
    try {
        const { refundId, status } = req.params;


        if (!refundId || !status) {
            return res.status(400).json({ message: 'Refund ID and status is required.' });
        }

        const pool = await poolPromise;

        const result = await pool.request()
            .input('Id', sql.Int, refundId)
            .input('decision', sql.NVarChar, status)
            .query(`
                UPDATE Refunds
                SET RefundStatus = @decision
                WHERE RefundId = @Id
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'Failed to update status.' });
        }

        res.status(200).json({ message: 'Refund status updated.' });

    } catch (err) {
        console.error('Error updating Refund status:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};