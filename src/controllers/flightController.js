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
        const { FlightNumber, DepartureAirport, ArrivalAirport, DepartureTime, ArrivalTime, EconomyPrice, BusinessClassPrice, FirstClassPrice } = req.body;

        if (!FlightNumber || !DepartureAirport || !ArrivalAirport || !DepartureTime || !ArrivalTime || !EconomyPrice || !BusinessClassPrice || !FirstClassPrice) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        const pool = await poolPromise;

        await pool.request()
        .input('FlightNumber', sql.NVarChar, FlightNumber) 
        .input('DepartureAirport', sql.INT, DepartureAirport) 
        .input('ArrivalAirport', sql.INT, ArrivalAirport) 
        .input('DepartureTime', sql.DateTime, DepartureTime) 
        .input('ArrivalTime', sql.DateTime, ArrivalTime) 
        .input('EconomyPrice', sql.Int, EconomyPrice)
        .input('BusinessClassPrice', sql.Int, BusinessClassPrice)
        .input('FirstClassPrice', sql.Int, FirstClassPrice)
            .query(`
                BEGIN TRY
                    BEGIN TRANSACTION
                        INSERT INTO Flights (FlightNumber, DepartureAirport, ArrivalAirport, DepartureTime, ArrivalTime)
                        VALUES (@FlightNumber, @DepartureAirport, @ArrivalAirport, @DepartureTime, @ArrivalTime);

                        DECLARE @FlightID INT = SCOPE_IDENTITY();

                        INSERT INTO FlightClasses (ClassName, FlightID, SeatCount, Price)
                        VALUES ('First Class', @FlightID, 12, @FirstClassPrice),
                        ('Business', @FlightID, 18, @BusinessClassPrice),
                        ('Economy', @FlightID, 30, @EconomyPrice);

                        EXEC GenerateSeatsForFlight @FlightID;

                    COMMIT;
                END TRY
                BEGIN CATCH
                    IF @@TRANCOUNT > 0
                    ROLLBACK;

                    DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
                    THROW 50000, @ErrorMessage, 1;
                END CATCH;
            `);

        res.status(201).json({ message: 'Flight Created successfully.' });

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
                    SELECT F.flightId, F.flightNumber, F.DepartureAirport, F.ArrivalAirport, F.DepartureTime, F.ArrivalTime, F.DelayedTime, F.DelayedStatus, F.Price, A1.Country AS 'DepartureCountry', A1.City AS 'DepartureCity', A1.AirportName AS 'DepartureAirportName', A2.Country AS 'ArrivalCountry', A2.City AS 'ArrivalCity', A2.AirportName AS 'ArrivalAirportName'  FROM Flights F INNER JOIN Airports A1 ON F.DepartureAirport = A1.AirportID INNER JOIN Airports A2 ON F.ArrivalAirport = A2.AirportID WHERE F.DepartureAirport = @DepartureAirport AND F.ArrivalAirport = @ArrivalAirport AND YEAR(F.DepartureTime) = YEAR(@DepartureTime) AND MONTH(F.DepartureTime) = MONTH(@DepartureTime) AND DAY(F.DepartureTime) = DAY(@DepartureTime);
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
                        A1.Country AS OutboundCountry,
                        A1.City AS OutboundCity,
                        A1.AirportName AS OutboundAirportName,

                        
                        ReturnFlight.FlightID AS ReturnFlightID,
                        ReturnFlight.FlightNumber AS ReturnFlightNumber,
                        ReturnFlight.DepartureTime AS ReturnDepartureTime,
                        ReturnFlight.ArrivalTime AS ReturnArrivalTime,
                        ReturnFlight.Price AS ReturnPrice,
                        A2.Country AS ArrivalCountry,
                        A2.City AS ArrivalCity,
                        A2.AirportName AS ArrivalAirportName
                    FROM 
                        Flights AS Outbound
                    JOIN 
                        Flights AS ReturnFlight
                        ON Outbound.DepartureAirport = ReturnFlight.ArrivalAirport
                        AND Outbound.ArrivalAirport = ReturnFlight.DepartureAirport
                    INNER JOIN 
                        Airports A1 
                        ON A1.AirportID = Outbound.DepartureAirport
                    INNER JOIN
                        Airports A2
                        ON A2.AirportID = Outbound.ArrivalAirport
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
                    SELECT F.flightId, F.flightNumber, F.DepartureAirport, F.ArrivalAirport, F.DepartureTime, F.ArrivalTime, F.DelayedTime, F.DelayedStatus, F.Price, A1.Country AS 'DepartureCountry', A1.City AS 'DepartureCity', A1.AirportName AS 'DepartureAirportName', A2.Country AS 'ArrivalCountry', A2.City AS 'ArrivalCity', A2.AirportName AS 'ArrivalAirportName'  FROM Flights F INNER JOIN Airports A1 ON F.DepartureAirport = A1.AirportID INNER JOIN Airports A2 ON F.ArrivalAirport = A2.AirportID WHERE FlightNumber = @flightNumber;
                `);
    
            res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

export const addDelay = async (req, res) => {
    try {
        const { flightId, delayTime } = req.params;


        if (!flightId || !delayTime) {
            return res.status(400).json({ message: 'Flight ID and delayTime is required.' });
        }

        const pool = await poolPromise;

        const result = await pool.request()
            .input('Id', sql.Int, flightId)
            .input('delayTime', sql.delayTime, delayTime)
            .query(`
                BEGIN TRY
                    BEGIN TRANSACTION
                        UPDATE Flights
                        SET DelayedStatus = 1
                        WHERE FlightId = @Id;
                        
                        UPDATE Flights
                        SET DelayedTime = @delayTime
                        WHERE FlightId = @Id;
                    COMMIT;
                END TRY
                BEGIN CATCH
                    IF @@TRANCOUNT > 0
                    ROLLBACK;
                END CATCH;
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'Failed to update status.' });
        }

        res.status(200).json({ message: 'Delayed status updated.' });

    } catch (err) {
        console.error('Error updating Delayed status:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};