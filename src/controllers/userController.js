import { sql, poolPromise } from "../config/db.js";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
dotenv.config();

export const registerUser = async (req, res) => {
  const { name, email, password, usertype } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(
      password,
      parseInt(process.env.BCRYPT_KEY)
    );
    const pool = await poolPromise;
    await pool
      .request()
      .input("FullName", sql.NVarChar, name)
      .input("email", sql.NVarChar, email)
      .input("passwordhash", sql.NVarChar, hashedPassword)
      .input("UserType", sql.NVarChar, usertype)
      .query(
        "INSERT INTO Users (email, passwordhash, fullname, usertype) VALUES (@email, @passwordhash, @FullName, @UserType)"
      );

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM Users");
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getUserById = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("UserID", sql.VarChar, req.params.id)
      .query("SELECT * FROM Users WHERE UserID = @UserID");

    if (result.recordset.length === 0)
      return res.status(404).json({ message: "User not found" });

    res.json(result.recordset[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getUserInfo = async (req, res) => {
  try {
    const {UserID} = req.body;
    const pool = await poolPromise;
    const result = await pool.request()
    .input("UserID", sql.Int, UserID)
    .query(`SELECT U.UserID, U.FullName, UI.Email, UI.PrimaryContact, UA.HouseNumber, UA.Street, UA.City, UA.Country   
                FROM Users U 
                INNER JOIN UserInfo UI 
                    ON UI.UserID = U.UserID 
                INNER JOIN UserAddress UA 
                    ON UA.AddressID = UI.Uaddress 
                WHERE U.UserID = @UserID`);

    if (result.recordset.length === 0)
      return res.status(404).json({ message: "User not found" });
    res.json(result.recordset[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateUserInfo = async (req, res) => {
  const {
    UserID,
    fullName,
    HouseNumber,
    Street,
    City,
    Country,
    PrimaryContact,
    Email,
  } = req.body;

  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);

  if (
    !UserID ||
    !fullName ||
    !HouseNumber ||
    !Street ||
    !City ||
    !Country ||
    !PrimaryContact ||
    !Email
  ) {
    return res.status(400).json({ message: "All parameters are required." });
  }

  try {
    await transaction.begin();

    const checkResult = await transaction
      .request()
      .input("UserID", sql.Int, UserID)
      .query(
        "SELECT UI.UserInfoID, UI.UAddress FROM UserInfo UI WHERE UI.UserID = @UserID"
      );

    if (checkResult.recordset.length > 0) {
      const userInfoID = checkResult.recordset[0].UserInfo;
      const addressID = checkResult.recordset[0].UAddress;

      await transaction
        .request()
        .input("AddressID", sql.Int, addressID)
        .input("HouseNumber", sql.Int, HouseNumber)
        .input("Street", sql.VarChar, Street)
        .input("City", sql.VarChar, City)
        .input("Country", sql.VarChar, Country).query(`
          UPDATE UserAddress
          SET HouseNumber = @HouseNumber, Street = @Street, City = @City, Country = @Country
          WHERE AddressID = @AddressID
        `);

      await transaction
        .request()
        .input("UserID", sql.Int, UserID)
        .input("PrimaryContact", sql.VarChar, PrimaryContact)
        .input('Email', sql.VarChar, Email)
        .query(`
          UPDATE UserInfo
          SET PrimaryContact = @PrimaryContact, Email = @Email 
          WHERE UserID = @UserID
        `);

      await transaction
        .request()
        .input("UserID", sql.Int, UserID)
        .input("FullName", sql.VarChar, fullName)
        .query(`
          UPDATE Users
          SET FullName = @FullName 
          WHERE UserID = @UserID
        `);

      await transaction.commit();
      return res.json({ message: "User info updated successfully" });
    } else {
      const addressInsert = await transaction
        .request()
        .input("HouseNumber", sql.Int, HouseNumber)
        .input("Street", sql.VarChar, Street)
        .input("City", sql.VarChar, City)
        .input("Country", sql.VarChar, Country).query(`
          INSERT INTO UserAddress (HouseNumber, Street, City, Country)
          OUTPUT INSERTED.AddressID
          VALUES (@HouseNumber, @Street, @City, @Country)
        `);

      const newAddressID = addressInsert.recordset[0].AddressID;

      await transaction
        .request()
        .input("UserID", sql.Int, UserID)
        .input("PrimaryContact", sql.VarChar, PrimaryContact)
        .input("UAddress", sql.Int, newAddressID)
        .input("Email", sql.VarChar, Email)
        .query(`
          INSERT INTO UserInfo (UserID, PrimaryContact, Email, UAddress)
          VALUES (@UserID, @PrimaryContact, @Email, @UAddress)
        `);

      await transaction
        .request()
        .input("UserID", sql.Int, UserID)
        .input("FullName", sql.VarChar, fullName)
        .query(`
          UPDATE Users
          SET FullName = @FullName 
          WHERE UserID = @UserID
        `);

      await transaction.commit();
      return res.json({ message: "User info created successfully" });
    }
  } catch (error) {
  await transaction.rollback();
  console.error("Update failed:", error);
  res.status(500).json({ error: "Database update failed", details: error.message });
}
};

export const deleteUser = async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("UserID", sql.VarChar, req.params.id)
      .query("DELETE FROM Users WHERE UserID = @UserID");

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
