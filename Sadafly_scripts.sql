﻿IF EXISTS (SELECT name FROM sys.databases WHERE name = 'SadaflyDB')
DROP DATABASE SadaflyDB;
CREATE DATABASE SadaflyDB;
USE SadaflyDB;

CREATE TABLE Users (
    UserID INT PRIMARY KEY IDENTITY(1,1),
    PasswordHash VARCHAR(255) NOT NULL,
    FullName VARCHAR(100) NOT NULL,
    Email VARCHAR(100) UNIQUE NOT NULL,
    UserType VARCHAR(50) CHECK (UserType IN ('Customer', 'Admin')) NOT NULL,
    CreatedAt DATETIME DEFAULT GETDATE()
);
SELECT * FROM FLIGHTS;
CREATE TABLE UserAddress(
    AddressID INT PRIMARY KEY IDENTITY(1,1),
	HouseNumber INT NOT NULL,
    Street VARCHAR(255) NOT NULL,
    City VARCHAR(255) NOT NULL,
    Country VARCHAR(255) NOT NULL
);

CREATE TABLE UserInfo(
    UserInfoID INT PRIMARY KEY IDENTITY(1,1),
    UserID INT FOREIGN KEY REFERENCES Users(UserID) ON DELETE CASCADE,
	Email VARCHAR(255) NOT NULL,
    PrimaryContact VARCHAR(20) NOT NULL,
    SecondaryContact VARCHAR(20),
    UAddress INT FOREIGN KEY REFERENCES UserAddress(AddressID) 
);

CREATE TABLE UserContact(
	UserContactID INT PRIMARY KEY IDENTITY(1,1),
	UName Varchar(255) NOT NULL,
	Email Varchar(255) NOT NULL,
	Phone Varchar(15) NOT NULL,
	UMessage Varchar(255) NOT NULL,
	Seen bit DEFAULT 0
);

CREATE TABLE Airports(
	AirportID INT PRIMARY KEY IDENTITY(1,1),
	Country VARCHAR(255) NOT NULL,
	AirportName Varchar(255) NOT NULL,
	City Varchar(255) NOT NULL,
	IATA_Code Varchar(3),
	ICAO_Code Varchar(4)
);

CREATE TABLE Flights (
    FlightID INT IDENTITY PRIMARY KEY,
    FlightNumber VARCHAR(20) UNIQUE NOT NULL,
    DepartureAirport INT FOREIGN KEY REFERENCES Airports(AirportID),
    ArrivalAirport INT FOREIGN KEY REFERENCES Airports(AirportID),
    DepartureTime DATETIME NOT NULL,
    ArrivalTime DATETIME NOT NULL,
	DelayedTime DATETIME,
	DelayedStatus bit DEFAULT 0,

	CHECK (DepartureAirport <> ArrivalAirport)
);

CREATE SEQUENCE FlightNumberSeq 
START WITH 1
INCREMENT BY 1;

CREATE TRIGGER trg_InsertFlights
ON Flights
INSTEAD OF INSERT
AS
BEGIN
    INSERT INTO Flights (FlightNumber, DepartureAirport, ArrivalAirport, DepartureTime, ArrivalTime, DelayedTime, DelayedStatus)
    SELECT
        'FL' + RIGHT('0000' + CAST(NEXT VALUE FOR FlightNumberSeq AS VARCHAR(4)), 4),
        DepartureAirport,
        ArrivalAirport,
        DepartureTime,
        ArrivalTime,
        DelayedTime,
        DelayedStatus
    FROM INSERTED;
END;


CREATE TABLE FlightClasses(
    ClassID INT IDENTITY(1,1) PRIMARY KEY,
    ClassName VARCHAR(50) NOT NULL CHECK (ClassName IN ('Economy', 'Business', 'First Class')),
    FlightID INT FOREIGN KEY REFERENCES Flights(FlightID) ON DELETE CASCADE,
	SeatCount INT NOT NULL,
	SeatBookedCount INT NOT NULL DEFAULT 0,
	Price Decimal(10,2) NOT NULL
);

CREATE TABLE Seats (
    SeatID INT IDENTITY PRIMARY KEY,
    FlightID INT FOREIGN KEY REFERENCES Flights(FlightID) ON DELETE NO ACTION,
    SeatNumber VARCHAR(10) NOT NULL,
    SeatClass INT FOREIGN KEY REFERENCES FlightClasses(ClassID) ON DELETE CASCADE,
    IsBooked BIT DEFAULT 0,
	CONSTRAINT UQ_Flight_SeatNumber UNIQUE (FlightID, SeatNumber) 
);

CREATE TABLE Bookings (
    BookingID INT IDENTITY(1,1) PRIMARY KEY,
	BookingNumber VarChar(20) UNIQUE NOT NULL,
    UserID INT FOREIGN KEY REFERENCES Users(UserID) ON DELETE CASCADE,
    FlightID INT FOREIGN KEY REFERENCES Flights(FlightID) ON DELETE NO ACTION, 
    BookingDate DATETIME DEFAULT GETDATE(),
    Status VARCHAR(50) CHECK (Status IN ('Confirmed', 'Cancelled', 'Pending')) NOT NULL,
    SeatID INT FOREIGN KEY REFERENCES Seats(SeatID) ON DELETE SET NULL 
);

CREATE SEQUENCE BookingNumberSeq 
START WITH 1 
INCREMENT BY 1;

CREATE TRIGGER trg_InsertBookings
ON Bookings
INSTEAD OF INSERT
AS
BEGIN
    INSERT INTO Bookings (BookingNumber, UserID, FlightID, BookingDate, Status, SeatID)
    SELECT
        'BK' + RIGHT('0000' + CAST(NEXT VALUE FOR BookingNumberSeq AS VARCHAR(4)), 4),
        UserID,
        FlightID,
        BookingDate,
        Status,
        SeatID
    FROM INSERTED;
END;

CREATE TABLE Payments (
    PaymentID INT IDENTITY PRIMARY KEY,
    BookingID INT FOREIGN KEY REFERENCES Bookings(BookingID) ON DELETE CASCADE,
    Amount INT NOT NULL,
    PaymentStatus VARCHAR(50) CHECK (PaymentStatus IN ('Paid', 'Failed', 'Refunded')) NOT NULL,
    TransactionDate DATETIME DEFAULT GETDATE()
);


CREATE TABLE Refunds (
    RefundID INT IDENTITY PRIMARY KEY,
    BookingID INT FOREIGN KEY REFERENCES Bookings(BookingID) ON DELETE CASCADE,
    Reason VARCHAR(255) NOT NULL,
    RefundAmount INT NOT NULL,
    RefundStatus VARCHAR(50) CHECK (RefundStatus IN ('Processing', 'Completed', 'Rejected')) DEFAULT 'Processing',
    RequestedAt DATETIME DEFAULT GETDATE()
);

SELECT * FROM Refunds;

CREATE TABLE TravelHistory (
    HistoryID INT IDENTITY PRIMARY KEY,
    UserID INT FOREIGN KEY REFERENCES Users(UserID) ON DELETE CASCADE,
    BookingID INT FOREIGN KEY REFERENCES Bookings(BookingID) ON DELETE NO ACTION,
    TravelDate DATETIME NOT NULL
);

CREATE PROCEDURE GenerateSeatsForFlight
    @FlightID INT
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM Seats WHERE FlightID = @FlightID)
        RETURN;

    DECLARE @ClassID INT, @ClassName VARCHAR(50), @SeatCount INT;
    DECLARE @Row INT, @SeatPerRow INT = 6, @TotalInserted INT, @Letter CHAR(1), @SeatNumber VARCHAR(10);

    DECLARE class_cursor CURSOR FOR
        SELECT ClassID, ClassName, SeatCount
        FROM FlightClasses
        WHERE FlightID = @FlightID;

    OPEN class_cursor;
    FETCH NEXT FROM class_cursor INTO @ClassID, @ClassName, @SeatCount;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @Row = 1;
        SET @TotalInserted = 0;

        WHILE @TotalInserted < @SeatCount
        BEGIN
            SET @Letter = 'A';
            WHILE ASCII(@Letter) <= ASCII('F') AND @TotalInserted < @SeatCount
            BEGIN
                SET @SeatNumber = CONCAT(@Row, @Letter);

                IF NOT EXISTS (
                    SELECT 1 FROM Seats
                    WHERE FlightID = @FlightID AND SeatNumber = @SeatNumber
                )
                BEGIN
                    INSERT INTO Seats (FlightID, SeatClass, SeatNumber)
                    VALUES (@FlightID, @ClassID, @SeatNumber);
                    SET @TotalInserted += 1;
                END

                SET @Letter = CHAR(ASCII(@Letter) + 1);
            END
            SET @Row += 1;
        END

        FETCH NEXT FROM class_cursor INTO @ClassID, @ClassName, @SeatCount;
    END

    CLOSE class_cursor;
    DEALLOCATE class_cursor;
END;



-- Airpots Data

-- Afghanistan
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Afghanistan', 'Hamid Karzai International Airport', 'Kabul', 'KBL', 'OAKB');

-- Albania
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Albania', 'Tirana International Airport', 'Tirana', 'TIA', 'LATI');

-- Algeria
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Algeria', 'Houari Boumediene Airport', 'Algiers', 'ALG', 'DAAG');

-- Andorra
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Andorra', 'Andorra la Vella Helipad', 'Andorra la Vella', 'ALV', 'LEAV');

-- Angola
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Angola', 'Quatro de Fevereiro Airport', 'Luanda', 'LAD', 'FNBB');

-- Antigua and Barbuda
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Antigua and Barbuda', 'V. C. Bird International Airport', 'St. Johns', 'ANU', 'TAPA');

-- Argentina
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Argentina', 'Ministro Pistarini International Airport', 'Buenos Aires', 'EZE', 'SAEZ');

-- Armenia
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Armenia', 'Zvartnots International Airport', 'Yerevan', 'EVN', 'UDYZ');

-- America
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('United States', 'Los Angeles International Airport', 'Los Angeles', 'LAX', 'KLAX');

-- Australia
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Australia', 'Sydney Kingsford Smith Airport', 'Sydney', 'SYD', 'YSSY');

-- Austria
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Austria', 'Vienna International Airport', 'Vienna', 'VIE', 'LOWW');

-- Azerbaijan
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Azerbaijan', 'Heydar Aliyev International Airport', 'Baku', 'GYD', 'UBBB');

-- Bahamas
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Bahamas', 'Lynden Pindling International Airport', 'Nassau', 'NAS', 'MYNN');

-- Bahrain
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Bahrain', 'Bahrain International Airport', 'Manama', 'BAH', 'OBBI');

-- Bangladesh
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Bangladesh', 'Hazrat Shahjalal International Airport', 'Dhaka', 'DAC', 'VGHS');

-- Barbados
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Barbados', 'Grantley Adams International Airport', 'Bridgetown', 'BGI', 'TBPB');

-- Belarus
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Belarus', 'Minsk National Airport', 'Minsk', 'MSQ', 'UMMS');

-- Belgium
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Belgium', 'Brussels Airport', 'Brussels', 'BRU', 'EBBR');

-- Belize
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Belize', 'Philip S. W. Goldson International Airport', 'Belize City', 'BZE', 'MZBZ');

-- Benin
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Benin', 'Cadjehoun Airport', 'Cotonou', 'COO', 'DBBB');

-- Bhutan
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Bhutan', 'Paro International Airport', 'Paro', 'PBH', 'VQPR');

-- Bolivia
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Bolivia', 'El Alto International Airport', 'La Paz', 'LPB', 'SLLP');

-- Bosnia and Herzegovina
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Bosnia and Herzegovina', 'Sarajevo International Airport', 'Sarajevo', 'SJJ', 'LQSA');

-- Botswana
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Botswana', 'Sir Seretse Khama International Airport', 'Gaborone', 'GBE', 'FBSK');

-- Brazil
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Brazil', 'São Paulo–Guarulhos International Airport', 'São Paulo', 'GRU', 'SBGR');

-- Brunei
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Brunei', 'Brunei International Airport', 'Bandar Seri Begawan', 'BWN', 'WBSB');

-- Bulgaria
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Bulgaria', 'Sofia Airport', 'Sofia', 'SOF', 'LBSF');

-- Burkina Faso
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Burkina Faso', 'Ouagadougou Airport', 'Ouagadougou', 'OUA', 'DFFF');

-- Burundi
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Burundi', 'Bujumbura International Airport', 'Bujumbura', 'BJM', 'HBBA');

-- Cabo Verde
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Cabo Verde', 'Amílcar Cabral International Airport', 'Espargos', 'SID', 'GVAC');

-- Cambodia
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Cambodia', 'Phnom Penh International Airport', 'Phnom Penh', 'PNH', 'VDPP');

-- Cameroon
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Cameroon', 'Douala International Airport', 'Douala', 'DLA', 'FKKD');

-- Canada
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Canada', 'Toronto Pearson International Airport', 'Toronto', 'YYZ', 'CYYZ');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Canada', 'Vancouver International Airport', 'Vancouver', 'YVR', 'CYVR');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Canada', 'Montréal–Trudeau International Airport', 'Montreal', 'YUL', 'CYUL');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Canada', 'Calgary International Airport', 'Calgary', 'YYC', 'CYYC');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Canada', 'Edmonton International Airport', 'Edmonton', 'YEG', 'CYEG');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Canada', 'Ottawa Macdonald–Cartier International Airport', 'Ottawa', 'YOW', 'CYOW');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Canada', 'Winnipeg James Armstrong Richardson International Airport', 'Winnipeg', 'YWG', 'CYWG');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Canada', 'Halifax Stanfield International Airport', 'Halifax', 'YHZ', 'CYHZ');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Canada', 'Québec City Jean Lesage International Airport', 'Quebec City', 'YQB', 'CYQB');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Canada', 'St. John’s International Airport', 'St. John’s', 'YYT', 'CYYT');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Canada', 'Billy Bishop Toronto City Airport', 'Toronto', 'YTZ', 'CYTZ');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Canada', 'Abbotsford International Airport', 'Abbotsford', 'YXX', 'CYXX');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Canada', 'Kelowna International Airport', 'Kelowna', 'YLW', 'CYLW');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Canada', 'Victoria International Airport', 'Victoria', 'YYJ', 'CYYJ');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Canada', 'Saskatoon John G. Diefenbaker International Airport', 'Saskatoon', 'YXE', 'CYXE');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Canada', 'Regina International Airport', 'Regina', 'YQR', 'CYQR');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Canada', 'Thunder Bay International Airport', 'Thunder Bay', 'YQT', 'CYQT');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Canada', 'Charlottetown Airport', 'Charlottetown', 'YYG', 'CYYG');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Canada', 'Whitehorse Erik Nielsen International Airport', 'Whitehorse', 'YXY', 'CYXY');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Canada', 'Yellowknife Airport', 'Yellowknife', 'YZF', 'CYZF');


-- Central African Republic
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Central African Republic', 'Bangui M’Poko International Airport', 'Bangui', 'BGF', 'FEFF');

-- Chad
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Chad', 'Djamena International Airport', 'Djamena', 'NDJ', 'FTTJ');

-- Chile
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Chile', 'Comodoro Arturo Merino Benítez International Airport', 'Santiago', 'SCL', 'SCEL');

-- China
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('China', 'Beijing Capital International Airport', 'Beijing', 'PEK', 'ZBAA');

-- Colombia
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Colombia', 'El Dorado International Airport', 'Bogotá', 'BOG', 'SKBO');

-- Comoros
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Comoros', 'Prince Said Ibrahim International Airport', 'Moroni', 'HAH', 'FMEE');

-- Congo (Republic of the Congo)
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Congo (Republic of the Congo)', 'Maya-Maya Airport', 'Brazzaville', 'BZV', 'FCBB');

-- Costa Rica
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Costa Rica', 'Juan Santamaría International Airport', 'San José', 'SJO', 'MROC');

-- Croatia
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Croatia', 'Franjo Tuđman Airport', 'Zagreb', 'ZAG', 'LDZA');

-- Cuba
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Cuba', 'José Martí International Airport', 'Havana', 'HAV', 'MUHA');

-- Cyprus
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Cyprus', 'Larnaca International Airport', 'Larnaca', 'LCA', 'LCLK');

-- Czech Republic
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Czech Republic', 'Václav Havel Airport Prague', 'Prague', 'PRG', 'LKPR');

-- Egypt
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Egypt', 'Cairo International Airport', 'Cairo', 'CAI', 'HECA');

-- El Salvador
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('El Salvador', 'Monseñor Óscar Arnulfo Romero International Airport', 'San Salvador', 'SAL', 'MSSS');

-- Equatorial Guinea
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Equatorial Guinea', 'Malabo International Airport', 'Malabo', 'SSG', 'FGSL');

-- Eritrea
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Eritrea', 'Asmara International Airport', 'Asmara', 'ASM', 'HHAS');

-- Estonia
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Estonia', 'Tallinn Lennart Meri Airport', 'Tallinn', 'TLL', 'EETN');

-- Eswatini (Swaziland)
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Eswatini', 'King Mswati III International Airport', 'Manzini', 'MTS', 'FMMS');

-- Ethiopia
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Ethiopia', 'Addis Ababa Bole International Airport', 'Addis Ababa', 'ADD', 'HAAB');

-- Fiji
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Fiji', 'Nadi International Airport', 'Nadi', 'NAN', 'NFFN');

-- Finland
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Finland', 'Helsinki-Vantaa Airport', 'Helsinki', 'HEL', 'EFHK');

-- France
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('France', 'Charles de Gaulle Airport', 'Paris', 'CDG', 'LFPG');

-- Gabon
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Gabon', 'Libreville International Airport', 'Libreville', 'LBV', 'FOOL');

-- Gambia
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Gambia', 'Banjul International Airport', 'Banjul', 'BJL', 'GBYD');

-- Georgia
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Georgia', 'Tbilisi International Airport', 'Tbilisi', 'TBS', 'UGTB');

-- Germany
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Germany', 'Frankfurt Airport', 'Frankfurt', 'FRA', 'EDDF');

-- Ghana
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Ghana', 'Kotoka International Airport', 'Accra', 'ACC', 'DGAA');

-- Greece
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Greece', 'Athens International Airport', 'Athens', 'ATH', 'LGAV');

-- Grenada
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Grenada', 'Maurice Bishop International Airport', 'St. George s', 'GND', 'TGPY');

-- Guatemala
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Guatemala', 'La Aurora International Airport', 'Guatemala City', 'GUA', 'MGGT');

-- Guinea
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Guinea', 'Conakry International Airport', 'Conakry', 'CKY', 'GUCY');

-- Guinea-Bissau
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Guinea-Bissau', 'Osvaldo Vieira International Airport', 'Bissau', 'OXB', 'GGBW');

-- Guyana
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Guyana', 'Cheddi Jagan International Airport', 'Georgetown', 'GEO', 'SYCJ');

-- Haiti
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Haiti', 'Toussaint Louverture International Airport', 'Port-au-Prince', 'PAP', 'MTPP');

-- Honduras
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Honduras', 'Tegucigalpa International Airport', 'Tegucigalpa', 'TGU', 'MHTG');

-- Hungary
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Hungary', 'Budapest Ferenc Liszt International Airport', 'Budapest', 'BUD', 'LHBP');

-- Iceland
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Iceland', 'Keflavík International Airport', 'Reykjavik', 'KEF', 'BIKF');

-- India
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('India', 'Indira Gandhi International Airport', 'Delhi', 'DEL', 'VIDP');

-- Indonesia
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Indonesia', 'Soekarno-Hatta International Airport', 'Jakarta', 'CGK', 'WIII');

-- Iran
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Iran', 'Tehran Imam Khomeini International Airport', 'Tehran', 'IKA', 'OIIE');

-- Iraq
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Iraq', 'Baghdad International Airport', 'Baghdad', 'BGW', 'ORBI');

-- Ireland
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Ireland', 'Dublin Airport', 'Dublin', 'DUB', 'EIDW');

-- Italy
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Italy', 'Leonardo da Vinci International Airport', 'Rome', 'FCO', 'LIRF');

-- Ivory Coast (Côte d Ivoire)
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Ivory Coast', 'Félix-Houphouët-Boigny International Airport', 'Abidjan', 'ABJ', 'DIAP');

-- Jamaica
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Jamaica', 'Norman Manley International Airport', 'Kingston', 'KIN', 'MKJS');

-- Japan
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Japan', 'Narita International Airport', 'Tokyo', 'NRT', 'RJAA');

-- Jordan
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Jordan', 'Queen Alia International Airport', 'Amman', 'AMM', 'OJAI');

-- Kazakhstan
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Kazakhstan', 'Almaty International Airport', 'Almaty', 'ALA', 'UAAA');

-- Kenya
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Kenya', 'Jomo Kenyatta International Airport', 'Nairobi', 'NBO', 'HKJK');

-- Kiribati
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Kiribati', 'Bonriki International Airport', 'Tarawa', 'TRW', 'NGTA');

-- Korea, North
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('North Korea', 'Pyongyang International Airport', 'Pyongyang', 'FNJ', 'ZKPY');

-- Korea, South
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('South Korea', 'Incheon International Airport', 'Seoul', 'ICN', 'RKSI');

-- Kuwait
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Kuwait', 'Kuwait International Airport', 'Kuwait City', 'KWI', 'OKBK');

-- Kyrgyzstan
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Kyrgyzstan', 'Manas International Airport', 'Bishkek', 'FRU', 'UAFM');

-- Laos
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Laos', 'Wattay International Airport', 'Vientiane', 'VTE', 'VLVT');

-- Latvia
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Latvia', 'Riga International Airport', 'Riga', 'RIX', 'EVRA');

-- Lebanon
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Lebanon', 'Rafic Hariri International Airport', 'Beirut', 'BEY', 'OLBA');

-- Lesotho
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Lesotho', 'Moshoeshoe I International Airport', 'Maseru', 'MSU', 'FXMM');

-- Liberia
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Liberia', 'Roberts International Airport', 'Monrovia', 'ROB', 'GL');

-- Libya
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Libya', 'Tripoli International Airport', 'Tripoli', 'TIP', 'HLLT');

-- Liechtenstein
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Liechtenstein', 'Zurich Airport', 'Zurich', 'ZRH', 'LSZH');

-- Lithuania
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Lithuania', 'Vilnius International Airport', 'Vilnius', 'VNO', 'EYVI');

-- Luxembourg
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Luxembourg', 'Luxembourg Airport', 'Luxembourg City', 'LUX', 'ELLX');

-- Madagascar
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Madagascar', 'Ivato International Airport', 'Antananarivo', 'TNR', 'FMMI');

-- Malawi
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Malawi', 'Kamuzu International Airport', 'Lilongwe', 'LLW', 'FWKI');

-- Malaysia
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Malaysia', 'Kuala Lumpur International Airport', 'Kuala Lumpur', 'KUL', 'WMKK');

-- Maldives
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Maldives', 'Malé International Airport', 'Malé', 'MLE', 'VRMM');

-- Mali
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Mali', 'Modibo Keita International Airport', 'Bamako', 'BKO', 'GABM');

-- Malta
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Malta', 'Malta International Airport', 'Luqa', 'MLA', 'LMML');

-- Marshall Islands
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Marshall Islands', 'Amata Kabua International Airport', 'Majuro', 'MAJ', 'PKMJ');

-- Mauritania
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Mauritania', 'Nouakchott–Oumtounsy International Airport', 'Nouakchott', 'NKC', 'GQNN');

-- Mauritius
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Mauritius', 'Sir Seewoosagur Ramgoolam International Airport', 'Plaisance', 'MRU', 'FIMP');

-- Mexico
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Mexico', 'Mexico City International Airport', 'Mexico City', 'MEX', 'MMMX');

-- Micronesia
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Micronesia', 'Yap International Airport', 'Yap', 'YAP', 'PICY');

-- Moldova
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Moldova', 'Chișinău International Airport', 'Chișinău', 'KIV', 'LUKK');

-- Monaco
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Monaco', 'Nice Côte d Azur Airport', 'Nice', 'NCE', 'LFMN');

-- Mongolia
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Mongolia', 'Chinggis Khaan International Airport', 'Ulaanbaatar', 'ULN', 'ZMUB');

-- Montenegro
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Montenegro', 'Podgorica Airport', 'Podgorica', 'TGD', 'LYPG');

-- Morocco
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Morocco', 'Mohammed V International Airport', 'Casablanca', 'CMN', 'GMMN');

-- Mozambique
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Mozambique', 'Maputo International Airport', 'Maputo', 'MPM', 'FQMA');

-- Namibia
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Namibia', 'Hosea Kutako International Airport', 'Windhoek', 'WDH', 'FYWH');

-- Nauru
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Nauru', 'Nauru International Airport', 'Yaren', 'INU', 'YNAR');

-- Nepal
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Nepal', 'Tribhuvan International Airport', 'Kathmandu', 'KTM', 'VNKT');

-- Netherlands
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Netherlands', 'Amsterdam Airport Schiphol', 'Amsterdam', 'AMS', 'EHAM');

-- New Zealand
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('New Zealand', 'Auckland Airport', 'Auckland', 'AKL', 'NZAA');

-- Nicaragua
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Nicaragua', 'Augusto C. Sandino International Airport', 'Managua', 'MGA', 'MNMG');

-- Niger
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Niger', 'Diori Hamani International Airport', 'Niamey', 'NIM', 'DRRN');

-- Nigeria
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Nigeria', 'Murtala Muhammed International Airport', 'Lagos', 'LOS', 'DNMM');

-- North Macedonia
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('North Macedonia', 'Skopje International Airport', 'Skopje', 'SKP', 'LWSK');

-- Norway
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Norway', 'Oslo Gardermoen Airport', 'Oslo', 'OSL', 'ENGM');

-- Oman
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Oman', 'Muscat International Airport', 'Muscat', 'MCT', 'OOMS');

-- Pakistan
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Allama Iqbal International Airport', 'Lahore', 'LHE', 'OPLA');

INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Islamabad International Airport', 'Islamabad', 'ISB', 'OPIS');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Jinnah International Airport', 'Karachi', 'KHI', 'OPKC');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Faisalabad International Airport', 'Faisalabad', 'LYP', 'OPFA');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Multan International Airport', 'Multan', 'MUX', 'OPMT');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Peshawar Bacha Khan International Airport', 'Peshawar', 'PEW', 'OPPS');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Quetta International Airport', 'Quetta', 'UET', 'OPQT');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Sialkot International Airport', 'Sialkot', 'SKT', 'OPST');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Skardu International Airport', 'Skardu', 'KDU', 'OPSD');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Gilgit Airport', 'Gilgit', 'GIL', 'OPGT');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Chitral Airport', 'Chitral', 'CJL', 'OPCH');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Gwadar International Airport', 'Gwadar', 'GWD', 'OPGD');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Turbat International Airport', 'Turbat', 'TUK', 'OPTU');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Sukkur Airport', 'Sukkur', 'SKZ', 'OPSK');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Shaikh Zayed International Airport', 'Rahim Yar Khan', 'RYK', 'OPRK');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Bahawalpur Airport', 'Bahawalpur', 'BHV', 'OPBW');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Nawabshah Airport', 'Nawabshah', 'WNS', 'OPNH');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Moenjodaro Airport', 'Mohenjo-daro', 'MJD', 'OPMJ');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Dalbandin Airport', 'Dalbandin', 'DBA', 'OPDB');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Dera Ghazi Khan International Airport', 'Dera Ghazi Khan', 'DEA', 'OPDG');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Dera Ismail Khan Airport', 'Dera Ismail Khan', 'DSK', 'OPDI');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Parachinar Airport', 'Parachinar', 'PAJ', 'OPPC');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Pasni Airport', 'Pasni City', 'PSI', 'OPPI');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Panjgur Airport', 'Panjgur', 'PJG', 'OPPG');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Ormara Airport', 'Ormara', 'ORW', 'OPOR');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Jiwani Airport', 'Jiwani', 'JIW', 'OPJI');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Khuzdar Airport', 'Khuzdar', 'KDD', 'OPKH');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Saidu Sharif Airport', 'Saidu Sharif', 'SDT', 'OPSS');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Zhob Airport', 'Zhob', 'PZH', 'OPZB');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Sibi Airport', 'Sibi', 'SBQ', 'OPSB');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Sindhri Airport', 'Sindhri', 'MPD', 'OPMP');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Muzaffarabad Airport', 'Muzaffarabad', 'MFG', 'OPMF');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Rawalakot Airport', 'Rawalakot', 'RAZ', 'OPRT');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Abbottabad Airport', 'Abbottabad', 'AAW', 'OPAB');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Bannu Airport', 'Bannu', 'BNP', 'OPBN');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Chilas Airport', 'Chilas', 'CHB', 'OPCL');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Hyderabad Airport', 'Hyderabad', 'HDD', 'OPKD');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Mangla Airport', 'Mangla', 'XJM', 'OPMA');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Sehwan Sharif Airport', 'Sehwan Sharif', 'SYW', 'OPSN');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Sui Airport', 'Sui', 'SUL', 'OPSU');
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Pakistan', 'Tarbela Dam Airport', 'Tarbela Dam', 'TLB', 'OPTA');

-- Palau
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Palau', 'Babeldaob Palau International Airport', 'Melekeok', 'ROR', 'PTRO');

-- Panama
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Panama', 'Tocumen International Airport', 'Panama City', 'PTY', 'MPTO');

-- Papua New Guinea
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Papua New Guinea', 'Port Moresby Jacksons International Airport', 'Port Moresby', 'POM', 'AYPY');

-- Paraguay
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Paraguay', 'Silvio Pettirossi International Airport', 'Asunción', 'ASU', 'SGAS');

-- Peru
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Peru', 'Jorge Chávez International Airport', 'Lima', 'LIM', 'SPJC');

-- Philippines
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Philippines', 'Ninoy Aquino International Airport', 'Manila', 'MNL', 'RPLL');

-- Poland
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Poland', 'Fryderyk Chopin Airport', 'Warsaw', 'WAW', 'EPWA');

-- Portugal
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Portugal', 'Lisbon Humberto Delgado Airport', 'Lisbon', 'LIS', 'LPPT');

-- Qatar
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Qatar', 'Hamad International Airport', 'Doha', 'DOH', 'OTHH');

-- Romania
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Romania', 'Henri Coandă International Airport', 'Bucharest', 'OTP', 'LROP');

-- Russia
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Russia', 'Sheremetyevo International Airport', 'Moscow', 'SVO', 'UUEE');

-- Rwanda
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Rwanda', 'Kigali International Airport', 'Kigali', 'KGL', 'HRYR');

-- Saint Kitts and Nevis
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Saint Kitts and Nevis', 'Robert L. Bradshaw International Airport', 'Basseterre', 'SKB', 'TKPK');

-- Saint Lucia
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Saint Lucia', 'Hewanorra International Airport', 'Vieux Fort', 'UVF', 'TLPL');

-- Saint Vincent and the Grenadines
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Saint Vincent and the Grenadines', 'Argyle International Airport', 'Argyle', 'SVD', 'TVSA');

-- Samoa
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Samoa', 'Faleolo International Airport', 'Apia', 'APW', 'NSFA');

-- San Marino
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('San Marino', 'Federico Fellini International Airport', 'Rimini', 'RMI', 'LIPR');

-- São Tomé and Príncipe
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('São Tomé and Príncipe', 'São Tomé International Airport', 'São Tomé', 'TMS', 'FPST');

-- Saudi Arabia
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Saudi Arabia', 'King Abdulaziz International Airport', 'Jeddah', 'JED', 'OEJN');

-- Senegal
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Senegal', 'Blaise Diagne International Airport', 'Dakar', 'DSS', 'GOBD');

-- Serbia
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Serbia', 'Belgrade Nikola Tesla Airport', 'Belgrade', 'BEG', 'LYBE');

-- Seychelles
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Seychelles', 'Seychelles International Airport', 'Mahé', 'SEZ', 'FSIA');

-- Sierra Leone
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Sierra Leone', 'Lungi International Airport', 'Freetown', 'FNA', 'GFLL');

-- Singapore
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Singapore', 'Changi Airport', 'Singapore', 'SIN', 'WSSS');

-- Slovakia
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Slovakia', 'M. R. Štefánik Airport', 'Bratislava', 'BTS', 'LZIB');

-- Slovenia
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Slovenia', 'Ljubljana Jože Pučnik Airport', 'Ljubljana', 'LJU', 'LJLJ');

-- Solomon Islands
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Solomon Islands', 'Honiara International Airport', 'Honiara', 'HIR', 'AGGH');

-- Somalia
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Somalia', 'Aden Adde International Airport', 'Mogadishu', 'MGQ', 'HCMQ');

-- South Africa
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('South Africa', 'O.R. Tambo International Airport', 'Johannesburg', 'JNB', 'FAOR');

-- South Korea
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('South Korea', 'Incheon International Airport', 'Seoul', 'ICN', 'RKSI');

-- South Sudan
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('South Sudan', 'Juba International Airport', 'Juba', 'JUB', 'HSJJ');

-- Spain
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Spain', 'Adolfo Suárez Madrid–Barajas Airport', 'Madrid', 'MAD', 'LEMD');

-- Sri Lanka
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Sri Lanka', 'Bandaranaike International Airport', 'Colombo', 'CMB', 'VCBI');

-- Sudan
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Sudan', 'Khartoum International Airport', 'Khartoum', 'KRT', 'HSSS');

-- Suriname
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Suriname', 'Johan Adolf Pengel International Airport', 'Paramaribo', 'PBM', 'SMJP');

-- Sweden
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Sweden', 'Stockholm Arlanda Airport', 'Stockholm', 'ARN', 'ESSA');

-- Switzerland
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Switzerland', 'Zurich Airport', 'Zurich', 'ZRH', 'LSZH');

-- Syria
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Syria', 'Damascus International Airport', 'Damascus', 'DAM', 'OSDI');

-- Taiwan
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Taiwan', 'Taoyuan International Airport', 'Taoyuan City', 'TPE', 'RCTP');

-- Tajikistan
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Tajikistan', 'Dushanbe International Airport', 'Dushanbe', 'DYU', 'UTDD');

-- Tanzania
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Tanzania', 'Julius Nyerere International Airport', 'Dar es Salaam', 'DAR', 'HTDA');

-- Thailand
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Thailand', 'Suvarnabhumi Airport', 'Bangkok', 'BKK', 'VTBS');

-- Togo
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Togo', 'Gnassingbé Eyadéma International Airport', 'Lomé', 'LFW', 'DXXX');

-- Tonga
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Tonga', 'Fuaʻamotu International Airport', 'Nukuʻalofa', 'TBU', 'NFTF');

-- Trinidad and Tobago
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Trinidad and Tobago', 'Piarco International Airport', 'Port of Spain', 'POS', 'TTPP');

-- Tunisia
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Tunisia', 'Tunis–Carthage International Airport', 'Tunis', 'TUN', 'DTTA');

-- Turkey
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Turkey', 'Istanbul Airport', 'Istanbul', 'IST', 'LTFM');

-- Turkmenistan
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Turkmenistan', 'Ashgabat International Airport', 'Ashgabat', 'ASB', 'UTAA');

-- Tuvalu
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Tuvalu', 'Funafuti International Airport', 'Funafuti', 'FUN', 'NGFU');

-- Uganda
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Uganda', 'Entebbe International Airport', 'Entebbe', 'EBB', 'HUEN');

-- Ukraine
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Ukraine', 'Boryspil International Airport', 'Kyiv', 'KBP', 'UKBB');

-- United Arab Emirates
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('United Arab Emirates', 'Dubai International Airport', 'Dubai', 'DXB', 'OMDB');

-- United Kingdom
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('United Kingdom', 'London Heathrow Airport', 'London', 'LHR', 'EGLL');

-- United States
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('United States', 'Los Angeles International Airport', 'Los Angeles', 'LAX', 'KLAX');

-- Uruguay
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Uruguay', 'Carrasco International Airport', 'Montevideo', 'MVD', 'SUMU');

-- Uzbekistan
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Uzbekistan', 'Tashkent International Airport', 'Tashkent', 'TAS', 'UTTT');

-- Vanuatu
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Vanuatu', 'Bauerfield International Airport', 'Port Vila', 'VLI', 'NVSY');

-- Vatican City
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Vatican City', 'Ciampino–G. B. Pastine International Airport', 'Rome', 'CIA', 'LIRA');

-- Venezuela
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Venezuela', 'Simón Bolívar International Airport', 'Caracas', 'CCS', 'SVMI');

-- Vietnam
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Vietnam', 'Noi Bai International Airport', 'Hanoi', 'HAN', 'VVNB');

-- Yemen
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Yemen', 'Sana a International Airport', 'Sana a', 'SAH', 'OYSN');

-- Zambia
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Zambia', 'Kenneth Kaunda International Airport', 'Lusaka', 'LUN', 'FLKK');

-- Zimbabwe
INSERT INTO Airports (Country, AirportName, City, IATA_Code, ICAO_Code) VALUES ('Zimbabwe', 'Harare International Airport', 'Harare', 'HRE', 'FVHA');