# Mobi Bestellungen

This is a prototype project for an ordering tool. I wrote this project up last spring to practicing and learning some new concepts. I am now publishing it, but wouldn't recommend using it without doing an audit of the code for yourself and also being aware of the limited scope of this project.

## Features

This project is intended for activists. It enables the creation of "campaigns" and setting up different items for that campaign that can then be ordered by the public.

All orders are encrypted with a public key specific for a campaign. The associated private key is encrypted with the campaign-specific password. Note that all this encryption and decryption happens on the server side and decryption / private keys are stored in memory of the server. The encryption is intended to supply protection on the on-disk stored data.

Orders can be viewed, managed and exported by the creator of the campaign.

<img alt="Mobi Bestellungen Example Orders List" src="https://github.com/user-attachments/assets/aac33035-a88e-4fdf-9922-61736416c479" />
<img width="300" alt="Mobi Bestellungen Example Ordering" src="https://github.com/user-attachments/assets/d0c05828-0191-4fb7-ae15-fa7e19749ba0" />
<img width="300" alt="Mobi Bestellungen Manage Items" src="https://github.com/user-attachments/assets/6355baba-d998-4fbb-b6a4-52df1147ff02" />

## Development and Deployment

For development you should set the environment variable `IS_PRODUCTION = false`.

For both development and deployment set the environment variable `JWT_SECRET = secret`.
