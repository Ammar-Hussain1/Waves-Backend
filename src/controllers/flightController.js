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
        const { flightType, fromAirport, toAirport, departureDate, returnDate, flightClassType } = req.body;
        if(!flightType)
        {
            return res.status(400).json({message: 'All fields are required.'});
        }
        if(flightType == 'one-way')
        {
            if (!fromAirport || !toAirport || !departureDate || !flightClassType) {
                return res.status(400).json({ message: 'All fields are required.' });
            }
            const pool = await poolPromise;

            const result = await pool.request()
                .input('DepartureAirport', sql.Int, fromAirport)
                .input('ArrivalAirport', sql.Int, toAirport)
                .input('DepartureTime', sql.NVarChar, departureDate)
                .input('flightClassType', sql.NVarChar, flightClassType)
                .query(`
                    SELECT 
                        F.flightId, F.flightNumber, F.DepartureAirport, F.ArrivalAirport, F.DepartureTime, 
                        F.ArrivalTime, F.DelayedTime, F.DelayedStatus, FC.Price, (FC.SeatCount - FC.SeatBookedCount) AS AvailableSeats, 
                        A1.Country AS 'DepartureCountry', A1.City AS 'DepartureCity', A1.AirportName AS 'DepartureAirportName', 
                        A2.Country AS 'ArrivalCountry', A2.City AS 'ArrivalCity', A2.AirportName AS 'ArrivalAirportName' 
                    FROM Flights F
                    INNER JOIN 
                        FlightClasses FC ON F.FlightID = FC.FlightID  
                    INNER JOIN 
                        Airports A1 ON F.DepartureAirport = A1.AirportID 
                    INNER JOIN 
                        Airports A2 ON F.ArrivalAirport = A2.AirportID 
                    WHERE 
                        F.DepartureAirport = @DepartureAirport 
                        AND F.ArrivalAirport = @ArrivalAirport 
                        AND YEAR(F.DepartureTime) = YEAR(@DepartureTime) 
                        AND MONTH(F.DepartureTime) = MONTH(@DepartureTime) 
                        AND DAY(F.DepartureTime) = DAY(@DepartureTime) 
                        AND (FC.SeatCount - FC.SeatBookedCount) > 0
                        AND FC.ClassName = @flightClassType;
                `);
    
            res.status(200).json(result.recordset);
        }
        else if(flightType == 'round-trip')
        {    
            if (!fromAirport || !toAirport || !departureDate || !returnDate || !flightClassType) {
                return res.status(400).json({ message: 'All fields are required.' });
            }
            const pool = await poolPromise;

            const result = await pool.request()
                .input('DepartureAirport', sql.Int, fromAirport)
                .input('ArrivalAirport', sql.Int, toAirport)
                .input('DepartureTime', sql.NVarChar, departureDate)
                .input('flightClassType', sql.NVarChar, flightClassType)
                .input('ReturnTime', sql.NVarChar, returnDate)
                .query(`
                    SELECT 
                        Outbound.FlightID AS OutboundFlightID,
                        Outbound.FlightNumber AS OutboundFlightNumber,
                        Outbound.DepartureTime AS OutboundDepartureTime,
                        Outbound.ArrivalTime AS OutboundArrivalTime,
                        (FC.SeatCount - FC.SeatBookedCount) AS AvailableOutboundSeats,
                        A1.Country AS OutboundCountry,
                        A1.City AS OutboundCity,
                        A1.AirportName AS OutboundAirportName,

                        
                        ReturnFlight.FlightID AS ReturnFlightID,
                        ReturnFlight.FlightNumber AS ReturnFlightNumber,
                        ReturnFlight.DepartureTime AS ReturnDepartureTime,
                        ReturnFlight.ArrivalTime AS ReturnArrivalTime,
                        (FC1.SeatCount - FC1.SeatBookedCount) AS AvailableReturnFlightSeats,
                        A2.Country AS ArrivalCountry,
                        A2.City AS ArrivalCity,
                        A2.AirportName AS ArrivalAirportName,

                        (FC1.Price + FC.Price) AS Price
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
                    INNER JOIN 
                        FlightClasses FC 
                        ON Outbound.FlightID = FC.FlightID
                    INNER JOIN 
                        FlightClasses FC1
                        ON ReturnFlight.FlightID = FC1.FlightID
                    WHERE 
                        Outbound.DepartureAirport = @DepartureAirport
                        AND Outbound.ArrivalAirport = @ArrivalAirport
                        AND YEAR(Outbound.DepartureTime) = YEAR(@DepartureTime)
                        AND MONTH(Outbound.DepartureTime) = MONTH(@DepartureTime)
                        AND DAY(Outbound.DepartureTime) = DAY(@DepartureTime)
                        AND YEAR(ReturnFlight.DepartureTime) = YEAR(@ReturnTime)
                        AND MONTH(ReturnFlight.DepartureTime) = MONTH(@ReturnTime)
                        AND DAY(ReturnFlight.DepartureTime) = DAY(@ReturnTime)
                        AND (FC.SeatCount - FC.SeatBookedCount) > 0
                        AND (FC1.SeatCount - FC1.SeatBookedCount) > 0
                        AND FC.ClassName = @flightClassType
                        AND FC1.ClassName = @flightClassType;
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
        const { flightId } = req.params;
        const { delayAmount, unit } = req.body; // delayAmount is a number, unit is 'minutes' or 'hours'

        if (!flightId || !delayAmount || !unit) {
            return res.status(400).json({ message: 'Flight ID, delay amount, and unit are required.' });
        }

        const pool = await poolPromise;

        // SQL code to add delay to existing DepartureTime
        const result = await pool.request()
        .input('Id', sql.Int, flightId)
        .input('DelayAmount', sql.Int, delayAmount)
        .input('Unit', sql.VarChar, unit)
        .query(`
            BEGIN TRY
            BEGIN TRANSACTION

                DECLARE @CurrentDeparture DATETIME;
                DECLARE @NewDelayedTime DATETIME;

                SELECT @CurrentDeparture = DepartureTime FROM Flights WHERE FlightId = @Id;

                IF @Unit = 'minutes'
                SET @NewDelayedTime = DATEADD(MINUTE, @DelayAmount, @CurrentDeparture);
                ELSE IF @Unit = 'hours'
                SET @NewDelayedTime = DATEADD(HOUR, @DelayAmount, @CurrentDeparture);
                ELSE
                BEGIN
                THROW 50000, 'Invalid time unit.', 1;
                END

                UPDATE Flights
                SET 
                DelayedStatus = 1,
                DelayedTime = @NewDelayedTime
                WHERE FlightId = @Id;

            COMMIT;
            END TRY
            BEGIN CATCH
            IF @@TRANCOUNT > 0
                ROLLBACK;
            THROW;
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
