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
        .input('FlightNumber', sql.NVarChar, FlightNumber) 
        .input('DepartureAirport', sql.NVarChar, DepartureAirport) 
        .input('ArrivalAirport', sql.NVarChar, ArrivalAirport) 
        .input('DepartureTime', sql.DateTime, DepartureTime) 
        .input('ArrivalTime', sql.DateTime, ArrivalTime) 
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
                .input('ReturnTime', sql.NVarChar, returnDate)
                .query(`
                    SELECT 
                        Outbound.FlightID AS OutboundFlightID,
                        Outbound.FlightNumber AS OutboundFlightNumber,
                        Outbound.DepartureTime AS OutboundDepartureTime,
                        Outbound.ArrivalTime AS OutboundArrivalTime,
                        Outbound.Price AS OutboundPrice,
                        
                        ReturnFlight.FlightID AS ReturnFlightID,
                        ReturnFlight.FlightNumber AS ReturnFlightNumber,
                        ReturnFlight.DepartureTime AS ReturnDepartureTime,
                        ReturnFlight.ArrivalTime AS ReturnArrivalTime,
                        ReturnFlight.Price AS ReturnPrice
                    FROM 
                        Flights AS Outbound
                    JOIN 
                        Flights AS ReturnFlight
                        ON Outbound.DepartureAirport = ReturnFlight.ArrivalAirport
                        AND Outbound.ArrivalAirport = ReturnFlight.DepartureAirport
                    WHERE 
                        Outbound.DepartureAirport = @DepartureAirport
                        AND Outbound.ArrivalAirport = @ArrivalAirport
                        AND YEAR(Outbound.DepartureTime) = YEAR(@DepartureTime)
                        AND MONTH(Outbound.DepartureTime) = MONTH(@DepartureTime)
                        AND DAY(Outbound.DepartureTime) = DAY(@DepartureTime)
                        AND YEAR(ReturnFlight.DepartureTime) = YEAR(@ReturnTime)
                        AND MONTH(ReturnFlight.DepartureTime) = MONTH(@ReturnTime)
                        AND DAY(ReturnFlight.DepartureTime) = DAY(@ReturnTime);
                    `);
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

export const trackFlight = async (req, res) => {
    try {
        const { flightNumber } = req.body;
        if(!flightNumber)
        {
            return res.status(400).json({message : 'All fields are required.'});
        }
            const pool = await poolPromise;

            const result = await pool.request()
                .input('flightNumber', sql.NVarChar, flightNumber)
                .query(`
                    SELECT FlightNumber, DepartureTime, ArrivalTime, DelayedTime, DelayedStatus FROM Flights WHERE flightNumber = @flightNumber;
                `);
    
            res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};
