import {MongoClient, ObjectID} from "mongodb";
import {GraphQLServer} from "graphql-yoga";
import * as uuid from 'uuid';
//falta la mutacion añadir facturas
import "babel-polyfill";

//logueado != registrado
//La api como sabe que yo ya estoy logueado¿?
//En el resolver que hago?

const usr = "avalero";
const pwd = "123456abc";
const url = "cluster0-vbkmi.gcp.mongodb.net/test?retryWrites=true&w=majority";

const connectToDb = async function(usr, pwd, url) {
    const uri = `mongodb+srv://${usr}:${pwd}@${url}`;
    const client = new MongoClient(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  
    await client.connect();
    return client;
};
//SOlo puedo hacer cosas sobre mis facturas
//al añadir factura meter usuario y token.
const runGraphQLServer = function(context){
    const typeDefs = `
        type Query{
            login(nombre:String!,contrasena:String!):Titulares
            logout(nombre:String!,contrasena:String!,token:ID!):Titulares
            getFacturas(nombre:String!,token:ID!):[Facturas!]
        }
        type Mutation{
            addUser(nombre:String!,contrasena:String!):Titulares!
            addFactura(nombre:String!,token:ID!,concepto:String!,cantidad:Int!,titular:String!): Facturas!
            removeUser(nombre:String!,token:ID!):Titulares
        }
        type Facturas{
            id: ID!
            fecha: String!
            concepto:String!
            cantidad: Int!
            titular:Titulares!
        }
        type Titulares{
            id: ID!
            nombre: String!
            contrasena: String!
            token: ID
        }

    `
    const resolvers = {
        Facturas:{
            titular:async(parent,args,ctx,info) =>{
                const titularnombre = parent.titular;
                const {client} = ctx;
                const db = client.db("Practica");
                const collection = db.collection("users");

                return(await collection.findOne({nombre: titularnombre}));
            }
        },
        Query:{
            login:async(parent,args,ctx,info)=>{
                const{nombre,contrasena} = args;
                const {client} = ctx;

                const db = client.db("Practica");
                const collection = db.collection("users");

                if(!await collection.findOne({nombre,contrasena})){
                    throw new Error(`El usuario no existe o no es esa contrasena`);
                }
                await collection.updateOne({nombre},{$set:{"token":uuid.v4()}});
                const result = await collection.findOne({nombre});
                return result;
            },
            logout:async(parent,args,ctx,info)=>{
                const{nombre,contrasena,token} = args;
                const {client} = ctx;

                const db = client.db("Practica");
                const collection = db.collection("users");

                if(!await collection.findOne({nombre,contrasena})){
                    throw new Error(`EL usuario no existe o no es esa la contrasena`);
                }
                if(await collection.findOne({nombre,contrasena})){
                    if(token === null){
                        throw new Error(`El usuario no esta logueado`);
                    }
                    await collection.updateOne({nombre},{$set:{"token":null}});
                    const result = await collection.findOne({nombre});
                    return result;
                }
            },
            getFacturas:async(parent,args,ctx,info) =>{
                const{nombre,token} = args;
                const {client} = ctx;
                const db = client.db("Practica");
                const collection = db.collection("users");
                const collection2 = db.collection("facturas");

                if(!await collection.findOne({nombre,token})){
                    throw new Error(`EL usuario no existe o no esta logueado para hacer esto`);
                }
                return await collection2.find({titular:nombre}).toArray();
               
            }
        },
        Mutation:{
            addUser:async(parent,args,ctx,info)=>{
                const{nombre,contrasena} = args;
                const {client} = ctx;
    
                const db = client.db("Practica");
                const collection = db.collection("users");
    
                if(await collection.findOne({nombre})){
                    throw new Error(`El usuario ya existe`);
                }
    
                const result = await collection.insertOne({nombre,contrasena});
    
                return{
                    nombre,
                    contrasena,
                    id: result.ops[0]._id
                };
    
            },
            addFactura:async(parent,args,ctx,info) =>{
                const{concepto,cantidad,titular,token,nombre} = args;
                const {client} = ctx;
                const db = client.db("Practica");
                const collection = db.collection("facturas");

                var date = new Date();
                var dia = String(date.getDate()).padStart(2,'0');
                var mes = String(date.getDate() + 1).padStart(2,'0');
                var ano = date.getFullYear();
                date = `${dia}/${mes}/${ano}`;
                const fecha = date;
                
                const collection2 = db.collection("users");

                if(!await collection2.findOne({nombre,token})){
                    throw new Error(`Este usuario no esta logueado para hacer esto`);
                }

                await collection.insertOne({fecha,concepto,cantidad,titular});
                const result = await collection.findOne({concepto});
                console.log(result.concepto);
                return result;
            },
            removeUser:async(parent,args,ctx,info) =>{
                const {nombre,token} = args;
                const{client} = ctx;
                const db = client.db("Practica");
                const collection = db.collection("users");
                const collection2 = db.collection("facturas");
                
                if(!await collection.findOne({nombre,token})){
                    throw new Error(`El usuario no esta logueado para realizar esta accion o no existe`);
                }

                const result = await collection.findOneAndDelete({nombre,token});

                await collection2.deleteMany({titular:nombre});

                return result.value;

            }
        }
        
    }
    const server = new GraphQLServer({ typeDefs, resolvers, context });
  const options = {
    port: 8000
  };

  try {
    server.start(options, ({ port }) =>
      console.log(
        `Server started, listening on port ${port} for incoming requests.`
      )
    );
  } catch (e) {
    console.info(e);
    server.close();
  }
};

const runApp = async function() {
  const client = await connectToDb(usr, pwd, url);
  console.log("Connect to Mongo DB");
  try {
    runGraphQLServer({ client });
    //En la otra le paso db: definicion... y esa mierda
  } catch (e) {
      console.log(e)
    client.close();
  }
};

runApp();





//PARA GENERAR EL TOKEN HACERLO CON UUID.V4();
//YO tengo la api y aqui tengo la base de datos y aqui está el fron que es lo de graphql
//EL proecso es lelgo y me registro, entonces para registrarme lo que le digo es
//mi usuario es taltalta y mi contraseña taltaltal
//Entonces compreuba la api si avalaero  ya esta cogido y si no lo esta
//la api guarda avalero y la contraseña, entonces la api te contesta
//que ya esta registrado.
//Luego entras y le dices que quieres login y le metes avalero 1234. Te dice si existe
//Entonecs se genera un token para qeu el se autentique. ES un numero aleatorio
//y lo guardo en la base de datos junto a a valero. ENtonces el usuario ya tiene la sesion iniciada
//CUando el usuario pida las facturas, dira quiero las facturas y soy avalero y mi token es taltaltaltal
//ENtonces por lo tanto le devuelvo las facturas
//Cuando te deslogueas, entonecs se borra el token, y  haria falta volver a loguearse
//NO SOLO UNA PERSONA PUEDE ESTAR CONECTADA A LA VEZ, LOGUEADOS PUEDE HABER INFINITOS