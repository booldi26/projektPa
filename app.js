const express = require('express');
const https = require('https');
const mysql = require('mysql');
const app = express();

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'pogodaData'
};

const con = mysql.createConnection({
  host: dbConfig.host,
  user: dbConfig.user,
  password: dbConfig.password,
});

function createDatabase() {
  con.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`, (err, result) => {
    if (err) throw err;
    console.log("Database created or already exists");
    con.changeUser({ database: dbConfig.database }, function (error) {
      if (error) throw error;
      setInterval(createTable, 10000);
    });
  });
}

function createTable() {
  const sql = `CREATE TABLE IF NOT EXISTS synop (
    id INT PRIMARY KEY,
    stacja VARCHAR(255),
    data_pomiaru VARCHAR(255),
    godzina_pomiaru VARCHAR(255),
    temperatura FLOAT,
    predkosc_wiatru INT,
    kierunek_wiatru INT,
    wilgotnosc_wzgledna FLOAT,
    suma_opadu INT,
    cisnienie FLOAT)`;

  con.query(sql, (err, result) => {
    if (err) throw err;
    getWeather(); 
    getWeatherLocation();
  });
}

function getWeather() {
  https.get('https://danepubliczne.imgw.pl/api/data/synop', (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      const jsonData = JSON.parse(data);
      jsonData.forEach(item => {
        const { id_stacji, stacja, data_pomiaru, godzina_pomiaru, temperatura, predkosc_wiatru, kierunek_wiatru, wilgotnosc_wzgledna, suma_opadu, cisnienie} = item;

        const query = `INSERT INTO synop VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
        ON DUPLICATE KEY UPDATE 
        data_pomiaru = VALUES(data_pomiaru), 
        godzina_pomiaru = VALUES(godzina_pomiaru), 
        temperatura = VALUES(temperatura), 
        predkosc_wiatru = VALUES(predkosc_wiatru), 
        kierunek_wiatru = VALUES(kierunek_wiatru), 
        wilgotnosc_wzgledna = VALUES(wilgotnosc_wzgledna), 
        suma_opadu = VALUES(suma_opadu), 
        cisnienie = VALUES(cisnienie)`;
        const values = jsonData.map(({ id_stacji, stacja, data_pomiaru, godzina_pomiaru, temperatura, predkosc_wiatru, kierunek_wiatru, wilgotnosc_wzgledna, suma_opadu, cisnienie }) => [id_stacji, stacja, data_pomiaru, godzina_pomiaru, temperatura, predkosc_wiatru, kierunek_wiatru, wilgotnosc_wzgledna, suma_opadu, cisnienie]);
        con.query(query, [values], (err, result) => {
          if (err) throw err;
        });
      });
    });
  }).on("error", (err) => {
    console.error("Error: " + err.message);
  });
}
function getWeatherLocation(){
  const jsonData = require(__dirname+'/filterLonLatCities.json');
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS places (
      miejscowosc VARCHAR(255),
      lon DECIMAL(10, 6),
      lat DECIMAL(10, 6)
    )`;
    con.query(createTableQuery, (err, result) => {
      if (err) throw err;
    });
    const insertDataQuery = 'INSERT INTO places (miejscowosc, lon, lat) VALUES ?';
    const values = jsonData.map(({ miejscowosc, lon, lat }) => [miejscowosc, lon, lat]);
    con.query(insertDataQuery, [values], (err, results, fields) => {
      if (err) {
        console.error('Error inserting data into table:', err);
      } else {
        console.log('Data inserted successfully');
      }
    });
}

createDatabase();

app.listen(3000, () => {
  console.log('Server is listening on port 3000');
});