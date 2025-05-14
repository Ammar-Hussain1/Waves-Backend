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
        const result = await pool.request().query(`SELECT R.RefundID, R.Reason, U.FullName AS UserName, F.FlightNumber FROM Refunds R 
            INNER JOIN Bookings B 
                ON B.BookingID = R.BookingID 
            INNER JOIN Users U ON
                U.UserID = B.UserID
            INNER JOIN Flights F ON
                F.FlightID = B.FlightID 
            WHERE RefundStatus = 'Processing'`);
        res.status(200).json(result.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getAllRejectedRefunds = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`SELECT R.RefundID, R.Reason, U.FullName AS UserName, F.FlightNumber FROM Refunds R 
            INNER JOIN Bookings B 
                ON B.BookingID = R.BookingID 
            INNER JOIN Users U ON
                U.UserID = B.UserID
            INNER JOIN Flights F ON
                F.FlightID = B.FlightID 
            WHERE RefundStatus = 'Rejected'`);
        res.status(200).json(result.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getAllCompletedRefunds = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`SELECT R.RefundID, R.Reason, U.FullName AS UserName, F.FlightNumber FROM Refunds R 
            INNER JOIN Bookings B 
                ON B.BookingID = R.BookingID 
            INNER JOIN Users U ON
                U.UserID = B.UserID
            INNER JOIN Flights F ON
                F.FlightID = B.FlightID 
            WHERE RefundStatus = 'Completed'`);
        res.status(200).json(result.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const createRefund = async (req, res) => {
    try {
        const {BookingNumber, Reason, UserID} = req.body;
        const pool = await poolPromise;
        const decision = await pool.request()
        .input('UserID', sql.Int, UserID)
        .input('BookingNumber', sql.VarChar, BookingNumber)
        .query(`
            SELECT * FROM Bookings B 
            WHERE BookingNumber = @BookingNumber AND UserID = @UserID;
            `);
        if(decision.recordset.length === 0)
        {
            res.status(400).json({message : 'Invalid Request.'});
            return;
        }

        const decision1 = await pool.request()
        .input('BookingNumber', sql.VarChar, BookingNumber)
        .query(`
            SELECT * FROM Bookings B 
            INNER JOIN Refunds R 
            ON R.BookingID = B.BookingID 
            WHERE BookingNumber = @BookingNumber; 
            `);
        if(decision1.recordset.length !== 0)
        {
            res.status(400).json({message : 'Refund Already Applied.'});
            return;
        }

        const result = await pool.request()
        .input('bookingNumber', sql.VarChar, BookingNumber)
        .input('userID', sql.Int, UserID)
        .input('reason', sql.NVarChar, Reason)
        .query(`
            BEGIN TRY
            BEGIN TRANSACTION
                DECLARE @RefundAmount INT;
                
                SELECT @RefundAmount = P.Amount FROM Bookings B 
                INNER JOIN Payments P 
                    ON P.BookingID = B.BookingID 
                WHERE B.BookingNumber = @bookingNumber;

                DECLARE @BookingID INT;
                SELECT @BookingID = B.BookingID
                FROM Bookings B
                WHERE BookingNumber = @BookingNumber; 

                INSERT INTO Refunds(BookingID, Reason, RefundAmount)
                VALUES (@BookingID, @reason, @RefundAmount);
            COMMIT;
            END TRY
            BEGIN CATCH
                IF @@TRANCOUNT > 0
                    ROLLBACK;
                THROW;
            END CATCH;
            `);
        res.status(200).json({message : "Refund Applied Successfully."});
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
                BEGIN TRY
                BEGIN TRANSACTION
                    UPDATE Refunds
                    SET RefundStatus = @decision
                    WHERE RefundId = @Id
                    
                    DECLARE @BookingID INT;
                    SELECT @BookingID = BookingID FROM Refunds WHERE RefundId = @Id;
                    
                    DECLARE @PaymentID INT;
                    SELECT @PaymentID = PaymentID FROM Payments P 
                        INNER JOIN Bookings B 
                        ON P.BookingID = B.BookingID
                        WHERE B.BookingID = @BookingID;
                    
                    IF @decision = 'Completed' 
                    BEGIN
                        UPDATE Payments
                        SET PaymentStatus = 'Refunded'
                        WHERE PaymentID = @PaymentID;
                        UPDATE Bookings
                        SET Status = 'Cancelled'
                        WHERE BookingID = @BookingID;
                    END;
                    
                COMMIT;
                END TRY 
                BEGIN CATCH
                    IF @@TRANCOUNT > 0
                        ROLLBACK TRANSACTION;

                    THROW;
                END CATCH;
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

export const getAllBookings = async (req, res) => {
    try {
        const {UserID} = req.body;
        if(!UserID)
        {
            res.status(400).json({message: "UserID not found"});
        }
        const pool = await poolPromise;
        const result = await pool.request()
        .input('UserID', sql.Int, UserID)
        .query(`SELECT B.BookingNumber, F.FlightNumber, B.BookingDate, B.Status, A1.AirportName AS 'DepartureAirport', A2.AirportName AS 'ArrivalAirport'  
            FROM Bookings B 
            INNER JOIN Flights F 
                ON F.FlightID = B.FlightID
            INNER JOIN Airports A1
                ON A1.AirportID = F.DepartureAirport 
            INNER JOIN Airports A2 
                ON A2.AirportID = F.ArrivalAirport
            WHERE 
                B.UserID = @UserID`);
        res.status(200).json(result.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


export const getAllRefundsForUser = async (req, res) => {
    try {
        const {UserID} = req.body;
        if(!UserID)
        {
            res.status(400).json({message: "UserID not found"});
        }
        const pool = await poolPromise;
        const result = await pool.request()
        .input('UserID', sql.Int, UserID)
        .query(`SELECT B.BookingNumber, R.RefundStatus, R.Reason, R.RefundAmount    
            FROM Bookings B 
            INNER JOIN Refunds R
                ON R.BookingID = B.BookingID
            WHERE 
                B.UserID = @UserID`);
        res.status(200).json(result.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
