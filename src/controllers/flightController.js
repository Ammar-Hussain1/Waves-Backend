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

// FlightNumber VARCHAR(20) UNIQUE NOT NULL,
//     DepartureAirport INT FOREIGN KEY REFERENCES Airports(AirportID),
//     ArrivalAirport INT FOREIGN KEY REFERENCES Airports(AirportID),
//     DepartureTime DATETIME NOT NULL,
//     ArrivalTime DATETIME NOT NULL,
// 	DelayedTime DATETIME,
// 	DelayedStatus bit DEFAULT 0, 
//     Price DECIMAL(10,2) NOT NULL,

export const createFlight = async (req, res) => {
    try {
        const { FlightNumber, DepartureAirport, ArrivalAirport, DepartureTime, ArrivalTime, Price } = req.body;

        if (!FlightNumber || !DepartureAirport || !ArrivalAirport || !DepartureTime || !ArrivalTime || !Price) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        const pool = await poolPromise;

        await pool.request()
            .input('FlightNumber', sql.Int, FlightNumber)
            .input('DepartureAirport', sql.Int, DepartureAirport)
            .input('ArrivalAirport', sql.Int, ArrivalAirport)
            .input('DepartureTime', sql.NVarChar, DepartureTime)
            .input('ArrivalTime', sql.NVarChar, ArrivalTime)
            .input('Price', sql.Int, Price)
            .query(`
                INSERT INTO Flights (FlightNumber, DepartureAirport, ArrivalAirport, DepartureTime, ArrivalTime, Price)
                VALUES (@FlightNumber, @DepartureAirport, @ArrivalAirport, @DepartureTime, @ArrivalTime, @Price)
            `);

        res.status(201).json({ message: 'Contact message submitted successfully.' });

    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

//one-way round-trip
export const searchFlight = async (req, res) => {
    try {
        const { flightType, fromAirport, toAirport, departureDate, returnDate } = req.body;
        if(!flightType)
        {
            return res.status(400).json({message: 'All fields are required.'});
        }
        if(flightType == 'one-way')
        {
            if (!fromAirport || !toAirport || !departureDate) {
                return res.status(400).json({ message: 'All fields are required.' });
            }
            const pool = await poolPromise;

            const result = await pool.request()
                .input('DepartureAirport', sql.Int, fromAirport)
                .input('ArrivalAirport', sql.Int, toAirport)
                .input('DepartureTime', sql.NVarChar, departureDate)
                .query(`
                    SELECT * FROM Flights WHERE DepartureAirport = @DepartureAirport AND ArrivalAirport = @ArrivalAirport AND YEAR(DepartureTime) = YEAR(@DepartureTime) AND MONTH(DepartureTime) = MONTH(@DepartureTime) AND DAY(DepartureTime) = DAY(@DepartureTime);
                `);
    
            res.status(200).json(result.recordset);
        }
        else if(flightType == 'round-trip')
        {    
            if (!fromAirport || !toAirport || !departureDate || !returnDate) {
                return res.status(400).json({ message: 'All fields are required.' });
            }
            const pool = await poolPromise;

            const result = await pool.request()
                .input('DepartureAirport', sql.Int, fromAirport)
                .input('ArrivalAirport', sql.Int, toAirport)
                .input('DepartureTime', sql.NVarChar, departureDate)
                .input('ArrivalTime', sql.NVarChar, returnDate)
                .query(`
                    SELECT * FROM Flights WHERE DepartureAirport = 1 AND ArrivalAirport = 2 AND YEAR(DepartureTime) = YEAR(@DepartureTime) AND MONTH(DepartureTime) = MONTH(@DepartureTime) AND DAY(DepartureTime) = DAY(@DepartureTime);
                `);

            const result2 = await pool.request()
                .input('DepartureAirport', sql.Int, toAirport)
                .input('ArrivalAirport', sql.Int, fromAirport)
                .input('DepartureTime', sql.NVarChar, ArrivalTime)
                .query(`
                    SELECT * FROM Flights WHERE DepartureAirport = @DepartureAirport AND ArrivalAirport = @ArrivalAirport AND YEAR(DepartureTime) = YEAR(@DepartureTime) AND MONTH(DepartureTime) = MONTH(@DepartureTime) AND DAY(DepartureTime) = DAY(@DepartureTime);
                `);
                
            if(result.recordset[0])
    
            res.status(200).json(result.recordset);
        }
        else
        {
            return res.status(400).json({message: 'Invalid Flight type'});
        }

    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};
