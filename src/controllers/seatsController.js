import { sql, poolPromise } from '../config/db.js';
import dotenv from 'dotenv';
dotenv.config();

export const getSeats = async (req, res) => {
    try {
        const {flightID, flightClassType} = req.body;
        if(!flightID || !flightClassType)
        {
            return res.status(400).json({message : 'flightID and flightClassType is required.'});
        }
        const pool = await poolPromise;
        const result = await pool.request()

        .input('flightID', sql.Int, flightID)
        .input('flightClassType', sql.VarChar, flightClassType)

        .input('flightID', sql.VarChar, flightID)
        .input('flightClassType', sql.NVarChar, flightClassType)

        .query(`SELECT S.SeatID, S.FlightID, S.SeatNumber, S.SeatClass, S.IsBooked, FC.ClassName 
            FROM Seats S 
            INNER JOIN 
                FlightClasses FC ON FC.ClassID = S.SeatClass AND FC.FlightID = S.FlightID
            WHERE 
                S.FlightID = @flightID AND FC.ClassName = @flightClassType;`);
        res.json(result.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const bookSeat = async (req, res) => {
    try {
        const { flightId, SeatID } = req.params;
        
        if (!flightId || !SeatID ) {
            return res.status(400).json({ message: 'Flight ID and Seat ID are required.' });
        }

        const pool = await poolPromise;

        const result = await pool.request()
        .input('flightID', sql.Int, flightId)
        .input('seatID', sql.Int, SeatID)
        .query(`
            UPDATE Seats 
            SET IsBooked = 1
            WHERE FlightID = @flightID AND SeatID = @seatID;
        `);

        const result1 = pool.request()
        .input('seatID', sql.Int, SeatID)
        .input('flightID', sql.Int, flightId)
        .query(`
            SELECT * FROM Seats Where SeatID = @seatID AND FlightID = @flightID;
            `);


        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'Failed to update status.' });
        }

        res.status(200).json({ message: 'Seat Booked.',  seat : result1.recordset});

    } catch (err) {
        console.error('Error booking seat:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};
