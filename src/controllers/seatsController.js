import { sql, poolPromise } from "../config/db.js";
import dotenv from "dotenv";
dotenv.config();

export const getSeats = async (req, res) => {
  try {
    const { flightID, flightClassType } = req.body;
    if (!flightID || !flightClassType) {
      return res
        .status(400)
        .json({ message: "flightID and flightClassType is required." });
    }
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("flightID", sql.Int, flightID)
      .input("flightClassType", sql.NVarChar, flightClassType)
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
    const { flightID, flightClass, SeatID, UserID, Amount, DepartureDate } =
      req.body;
    if (
      !flightID ||
      !flightClass ||
      !SeatID ||
      !UserID ||
      !Amount ||
      !DepartureDate
    ) 
    {
      return res.status(400).json({ message: "All paramters are required." });
    }

    const pool = await poolPromise;

    const decision = await pool.request().input("seatID", sql.Int, SeatID)
      .query(`SELECT IsBooked 
            FROM Seats
            WHERE
                SeatID = @seatID`);
    if (decision.recordset.length === 0) {
      return res.status(404).json({ message: "Seat Not Found." });
    }

    const IsBooked = decision.recordset[0].IsBooked;
    console.log(IsBooked);
    if (IsBooked == 0) {
      const result = await pool
        .request()
        .input("flightID", sql.Int, flightID)
        .input("seatID", sql.Int, SeatID)
        .input("userID", sql.Int, UserID)
        .input("Amount", sql.Int, Amount)
        .input("DepartureDate", sql.DateTime, DepartureDate)
        .input("flightClass", sql.VarChar, flightClass).query(`
            BEGIN TRY
            BEGIN TRANSACTION

                DECLARE @BookingID INT;

                UPDATE Seats 
                    SET IsBooked = 1 
                WHERE 
                    SeatID = @seatID;

                DECLARE @flightClassID INT;

                SELECT @flightClassID = FC.ClassID
                FROM Flights F 
                INNER JOIN FlightClasses FC 
                  ON F.FlightID = FC.FlightID
                WHERE FC.ClassName = @flightClass
                AND F.FlightID = @flightID; 
                
                UPDATE FlightClasses 
                    SET SeatBookedCount = SeatBookedCount + 1
                WHERE
                    ClassID = @flightClassID;

                INSERT INTO Bookings (UserID, FlightID, Status, SeatID) 
                VALUES (@userID, @flightID, 'Confirmed', @seatID);

                SELECT Top 1 @BookingID = BookingID FROM Bookings 
                WHERE 
                    UserID = @userID AND FlightID = @flightID AND SeatID = @SeatID
                ORDER BY BookingDate DESC;

                INSERT INTO Payments (BookingID, Amount, PaymentStatus)  
                VALUES (@BookingID, @Amount, 'Paid');

                INSERT INTO TravelHistory (UserID, BookingID, TravelDate) 
                VALUES (@userID, @BookingID, @DepartureDate);
                
            COMMIT;
            END TRY
            BEGIN CATCH
            IF @@TRANCOUNT > 0
                ROLLBACK;
            THROW;
            END CATCH;
        `);

      if (result.rowsAffected[0] === 0) {
        return res.status(404).json({ message: "Failed to update status." });
      }

      res.status(200).json({ message: "Seat Booked Successfully." });
    } else {
      res.status(400).json({ message: "Apologies, Seat Already Booked" });
    }
  } catch (err) {
    res.status(500).json({ message: "Internal server error." });
  }
};

export const bookSeatRoundTrip = async (req, res) => {
  try {
    const { flightIDReturn, flightIDOutbound, flightClass, SeatIDReturn, SeatIDOutbound, UserID, AmountOutbound, AmountReturn, DepartureDate, ReturnDate } =
      req.body;
    if (
      !flightIDReturn ||
      !flightIDOutbound ||
      !flightClass ||
      !SeatIDReturn ||
      !SeatIDOutbound ||
      !UserID ||
      !AmountOutbound ||
      !AmountReturn ||
      !DepartureDate ||
      !ReturnDate 
    ) 
    {
      return res.status(400).json({ message: "All paramters are required." });
    }

    const pool = await poolPromise;

    const decision = await pool.request().input("seatID", sql.Int, SeatIDReturn)
      .query(`SELECT IsBooked 
            FROM Seats
            WHERE
                SeatID = @seatID`);
    const decision1 = await pool.request().input("seatID", sql.Int, SeatIDOutbound)
      .query(`SELECT IsBooked 
            FROM Seats
            WHERE
                SeatID = @seatID`);
    const outboundBooked = decision.recordset[0].IsBooked;
    const returnBooked = decision1.recordset[0].IsBooked;

    console.log(`outbound ${outboundBooked}`);
    console.log(`return ${returnBooked}`);

    if(outboundBooked == 1 && returnBooked == 1)
    {
      res.status(400).json({message : 'Apologies both Seats Already Booked'});
    }
    else if(outboundBooked == 1)
    {
      res.status(400).json({message : 'Apologies Return Seat Already Booked'});
    }
    else if (returnBooked == 1)
    {
      res.status(400).json({message : 'Apologies Outbound Seat Already Booked'});
    }
    else
    {
      const result = await pool
        .request()
        .input("flightIDReturn", sql.Int, flightIDReturn)
        .input("flightIDOutbound", sql.Int, flightIDOutbound)
        .input("seatIDReturn", sql.Int, SeatIDReturn)
        .input("seatIDOutbound", sql.Int, SeatIDOutbound)
        .input("userID", sql.Int, UserID)
        .input("AmountReturn", sql.Int, AmountReturn)
        .input("AmountOutbound", sql.Int, AmountOutbound)
        .input("DepartureDate", sql.DateTime, DepartureDate)
        .input("ReturnDate", sql.DateTime, ReturnDate)
        .input("flightClass", sql.VarChar, flightClass)
        .query(`
            BEGIN TRY
            BEGIN TRANSACTION

                DECLARE @BookingIDOutbound INT;
                DECLARE @BookingIDReturn INT;
                DECLARE @flightClassIDOutbound INT;
                DECLARE @flightClassIDReturn INT;

                UPDATE Seats 
                    SET IsBooked = 1 
                WHERE 
                    SeatID = @seatIDOutbound;

                UPDATE Seats 
                    SET IsBooked = 1 
                WHERE 
                    SeatID = @seatIDReturn;

                SELECT @flightClassIDOutbound = FC.ClassID 
                FROM Flights F 
                INNER JOIN FlightClasses FC 
                  ON F.FlightID = FC.FlightID
                WHERE FC.ClassName = @flightClass
                AND F.FlightID = @flightIDOutbound;

                SELECT @flightClassIDReturn = FC.ClassID 
                FROM Flights F 
                INNER JOIN FlightClasses FC 
                  ON F.FlightID = FC.FlightID
                WHERE FC.ClassName = @flightClass
                AND F.FlightID = @flightIDReturn;

                
                UPDATE FlightClasses 
                    SET SeatBookedCount = SeatBookedCount + 1
                WHERE
                    ClassID = @flightClassIDOutbound;

                UPDATE FlightClasses 
                    SET SeatBookedCount = SeatBookedCount + 1
                WHERE
                    ClassID = @flightClassIDReturn;

                INSERT INTO Bookings (UserID, FlightID, Status, SeatID) 
                VALUES (@userID, @flightIDOutbound, 'Confirmed', @seatIDOutbound);

                SELECT Top 1 @BookingIDOutbound = BookingID FROM Bookings 
                WHERE 
                    UserID = @userID AND FlightID = @flightIDOutbound AND SeatID = @SeatIDOutbound
                ORDER BY BookingDate DESC;

                INSERT INTO Bookings (UserID, FlightID, Status, SeatID) 
                VALUES (@userID, @flightIDReturn, 'Confirmed', @seatIDReturn);

                SELECT Top 1 @BookingIDReturn = BookingID FROM Bookings 
                WHERE 
                    UserID = @userID AND FlightID = @flightIDReturn AND SeatID = @SeatIDReturn
                ORDER BY BookingDate DESC;

                INSERT INTO Payments (BookingID, Amount, PaymentStatus)  
                VALUES (@BookingIDOutbound, @AmountOutbound, 'Paid');

                INSERT INTO Payments (BookingID, Amount, PaymentStatus)  
                VALUES (@BookingIDReturn, @AmountReturn, 'Paid');

                INSERT INTO TravelHistory (UserID, BookingID, TravelDate) 
                VALUES (@userID, @BookingIDOutbound, @DepartureDate);

                INSERT INTO TravelHistory (UserID, BookingID, TravelDate) 
                VALUES (@userID, @BookingIDReturn, @ReturnDate);
                
            COMMIT;
            END TRY
            BEGIN CATCH
            IF @@TRANCOUNT > 0
                ROLLBACK;
            THROW;
            END CATCH;
        `);

      if (result.rowsAffected[0] === 0) {
        return res.status(404).json({ message: "Failed to Book Seat." });
      }

      res.status(200).json({ message: "Seat Booked Successfully." });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error." });
  }
};
