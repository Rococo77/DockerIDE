import React, { useState, useEffect, useRef } from 'react';

interface ProjectCreatorProps {
    isOpen: boolean;
    onClose: () => void;
    onProjectCreated: (projectPath: string) => void;
}

interface LanguageTemplate {
    id: string;
    name: string;
    icon: string;
    image: string;
    description: string;
    templates: ProjectTemplate[];
}

interface ProjectTemplate {
    id: string;
    name: string;
    description: string;
    framework?: string;
    requiresInstall?: boolean;
    installCommand?: string;
    startCommand?: string;
    setupImage?: string; // Image spécifique pour l'installation (ex: composer pour PHP)
    ports?: number[];
    files: { path: string; content: string }[];
}

const LANGUAGE_TEMPLATES: LanguageTemplate[] = [
    // =========================================
    // PHP - Laravel, Symfony
    // =========================================
    {
        id: 'php',
        name: 'PHP',
        icon: 'HP',
        image: 'composer:latest',
        description: 'PHP 8.2 with Composer',
        templates: [
            {
                id: 'php-basic',
                name: 'Projet basique',
                description: 'Un fichier index.php simple',
                files: [
                    {
                        path: 'index.php',
                        content: `<?php
/**
 * Mon premier projet PHP dans Docker IDE
 */

echo "Hello from Docker IDE!\\n";
echo "Modifiez ce fichier et appuyez sur F5 pour exécuter\\n";

// Exemple avec array
$numbers = [1, 2, 3, 4, 5];
$doubled = array_map(fn($n) => $n * 2, $numbers);
echo "Nombres doublés: " . implode(", ", $doubled) . "\\n";
`,
                    },
                ],
            },
            {
                id: 'php-laravel',
                name: 'Laravel',
                description: 'Application Laravel complète',
                framework: 'Laravel',
                requiresInstall: true,
                setupImage: 'composer:latest',
                installCommand: 'composer create-project laravel/laravel . --prefer-dist --no-interaction && php artisan key:generate',
                startCommand: 'php artisan serve --host=0.0.0.0 --port=8000',
                ports: [8000],
                files: [
                    {
                        path: '.docker-ide.json',
                        content: JSON.stringify({
                            framework: 'laravel',
                            image: 'php:8.2-cli',
                            setupImage: 'composer:latest',
                            installCommand: 'composer create-project laravel/laravel . --prefer-dist --no-interaction && php artisan key:generate',
                            startCommand: 'php artisan serve --host=0.0.0.0 --port=8000',
                            ports: [8000],
                        }, null, 2),
                    },
                    {
                        path: 'README.md',
                        content: `# Projet Laravel

## Installation

Le projet sera automatiquement initialisé lors de la première exécution.

\`\`\`bash
composer create-project laravel/laravel .
php artisan key:generate
\`\`\`

## Démarrage

\`\`\`bash
php artisan serve --host=0.0.0.0 --port=8000
\`\`\`

## Documentation

- [Laravel Docs](https://laravel.com/docs)
`,
                    },
                ],
            },
            {
                id: 'php-symfony',
                name: 'Symfony',
                description: 'Application Symfony 7',
                framework: 'Symfony',
                requiresInstall: true,
                setupImage: 'composer:latest',
                installCommand: 'composer create-project symfony/skeleton . --prefer-dist --no-interaction && composer require webapp --no-interaction',
                startCommand: 'php -S 0.0.0.0:8000 -t public',
                ports: [8000],
                files: [
                    {
                        path: '.docker-ide.json',
                        content: JSON.stringify({
                            framework: 'symfony',
                            image: 'php:8.2-cli',
                            setupImage: 'composer:latest',
                            installCommand: 'composer create-project symfony/skeleton . --prefer-dist --no-interaction && composer require webapp --no-interaction',
                            startCommand: 'php -S 0.0.0.0:8000 -t public',
                            ports: [8000],
                        }, null, 2),
                    },
                    {
                        path: 'README.md',
                        content: `# Projet Symfony

## Installation

\`\`\`bash
composer create-project symfony/skeleton .
composer require webapp
\`\`\`

## Démarrage

\`\`\`bash
php -S 0.0.0.0:8000 -t public
\`\`\`

## Documentation

- [Symfony Docs](https://symfony.com/doc/current/index.html)
`,
                    },
                ],
            },
        ],
    },
    // =========================================
    // Python - Django, FastAPI, Flask
    // =========================================
    {
        id: 'python',
        name: 'Python',
        icon: 'PY',
        image: 'python:3.11-slim',
        description: 'Python 3.11 with pip',
        templates: [
            {
                id: 'python-basic',
                name: 'Projet basique',
                description: 'Un fichier main.py simple',
                files: [
                    {
                        path: 'main.py',
                        content: `#!/usr/bin/env python3
"""Mon premier projet Python dans Docker IDE"""

def main():
    print("Hello from Docker IDE!")
    print("Modifiez ce fichier et appuyez sur F5 pour exécuter")
    
    # Exemple avec list comprehension
    numbers = [1, 2, 3, 4, 5]
    doubled = [n * 2 for n in numbers]
    print(f"Nombres doublés: {doubled}")

if __name__ == "__main__":
    main()
`,
                    },
                    {
                        path: 'README.md',
                        content: `# Mon Projet Python

## Exécution

Appuyez sur **F5** ou cliquez sur le bouton **Exécuter** pour lancer le programme.
`,
                    },
                ],
            },
            {
                id: 'python-flask',
                name: 'Flask',
                description: 'Application Web Flask légère',
                framework: 'Flask',
                requiresInstall: true,
                installCommand: 'pip install -r requirements.txt',
                startCommand: 'python app.py',
                files: [
                    {
                        path: 'app.py',
                        content: `from flask import Flask, jsonify, render_template_string

app = Flask(__name__)

HTML = """
<!DOCTYPE html>
<html>
<head>
    <title>Docker IDE - Flask</title>
    <style>
        body { font-family: Arial; text-align: center; padding: 50px; background: #1e1e1e; color: white; }
        h1 { color: #0078d4; }
        .card { background: #2d2d2d; padding: 20px; border-radius: 8px; margin: 20px auto; max-width: 500px; }
    </style>
</head>
<body>
    <h1>Flask App</h1>
    <div class="card">
        <p>Votre serveur Flask fonctionne dans Docker!</p>
        <p>Visitez <a href="/api/status" style="color: #4ec9b0;">/api/status</a> pour voir l'API</p>
    </div>
</body>
</html>
"""

@app.route('/')
def home():
    return render_template_string(HTML)

@app.route('/api/status')
def status():
    return jsonify({
        "status": "running",
        "framework": "Flask",
        "message": "Hello from Docker IDE!"
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
`,
                    },
                    {
                        path: 'requirements.txt',
                        content: `flask==3.0.0
python-dotenv==1.0.0
`,
                    },
                    {
                        path: '.docker-ide.json',
                        content: JSON.stringify({
                            framework: 'flask',
                            installCommand: 'pip install -r requirements.txt',
                            startCommand: 'python app.py',
                            ports: [5000],
                        }, null, 2),
                    },
                ],
            },
            {
                id: 'python-django',
                name: 'Django',
                description: 'Application Django complète',
                framework: 'Django',
                requiresInstall: true,
                installCommand: 'pip install django && django-admin startproject myproject . && python manage.py migrate',
                startCommand: 'python manage.py runserver 0.0.0.0:8000',
                files: [
                    {
                        path: '.docker-ide.json',
                        content: JSON.stringify({
                            framework: 'django',
                            installCommand: 'pip install django && django-admin startproject myproject . && python manage.py migrate',
                            startCommand: 'python manage.py runserver 0.0.0.0:8000',
                            ports: [8000],
                        }, null, 2),
                    },
                    {
                        path: 'requirements.txt',
                        content: `django>=4.2
djangorestframework>=3.14
`,
                    },
                    {
                        path: 'README.md',
                        content: `# Projet Django

## Installation

\`\`\`bash
pip install -r requirements.txt
django-admin startproject myproject .
python manage.py migrate
\`\`\`

## Démarrage

\`\`\`bash
python manage.py runserver 0.0.0.0:8000
\`\`\`

## Admin

Créez un superuser: \`python manage.py createsuperuser\`
`,
                    },
                ],
            },
            {
                id: 'python-fastapi',
                name: 'FastAPI',
                description: 'API moderne et rapide',
                framework: 'FastAPI',
                requiresInstall: true,
                installCommand: 'pip install -r requirements.txt',
                startCommand: 'uvicorn main:app --host 0.0.0.0 --port 8000 --reload',
                files: [
                    {
                        path: 'main.py',
                        content: `from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional

app = FastAPI(
    title="Docker IDE API",
    description="API built with FastAPI in Docker IDE",
    version="1.0.0"
)

class Item(BaseModel):
    name: str
    description: Optional[str] = None
    price: float

items = []

@app.get("/")
def root():
    return {
        "message": "Hello from Docker IDE!",
        "docs": "/docs",
        "redoc": "/redoc"
    }

@app.get("/api/items")
def get_items():
    return {"items": items}

@app.post("/api/items")
def create_item(item: Item):
    items.append(item)
    return {"message": "Item created", "item": item}

@app.get("/api/status")
def status():
    return {"status": "running", "framework": "FastAPI"}
`,
                    },
                    {
                        path: 'requirements.txt',
                        content: `fastapi>=0.104.0
uvicorn[standard]>=0.24.0
pydantic>=2.5.0
`,
                    },
                    {
                        path: '.docker-ide.json',
                        content: JSON.stringify({
                            framework: 'fastapi',
                            installCommand: 'pip install -r requirements.txt',
                            startCommand: 'uvicorn main:app --host 0.0.0.0 --port 8000 --reload',
                            ports: [8000],
                        }, null, 2),
                    },
                ],
            },
        ],
    },
    // =========================================
    // JavaScript/Node.js - Express, React, Vue, Next.js
    // =========================================
    {
        id: 'javascript',
        name: 'JavaScript',
        icon: 'JS',
        image: 'node:20-alpine',
        description: 'Node.js 20 LTS',
        templates: [
            {
                id: 'js-basic',
                name: 'Projet basique',
                description: 'Un fichier index.js simple',
                files: [
                    {
                        path: 'index.js',
                        content: `/**
 * Mon premier projet JavaScript dans Docker IDE
 */

function main() {
    console.log("Hello from Docker IDE!");
    console.log("Modifiez ce fichier et appuyez sur F5 pour exécuter");
    
    const numbers = [1, 2, 3, 4, 5];
    const doubled = numbers.map(n => n * 2);
    console.log("Nombres doublés:", doubled);
}

main();
`,
                    },
                    {
                        path: 'package.json',
                        content: JSON.stringify({
                            name: "mon-projet",
                            version: "1.0.0",
                            description: "Projet créé avec Docker IDE",
                            main: "index.js",
                            scripts: {
                                start: "node index.js"
                            }
                        }, null, 2),
                    },
                ],
            },
            {
                id: 'js-express',
                name: 'Express',
                description: 'API REST avec Express.js',
                framework: 'Express',
                requiresInstall: true,
                installCommand: 'npm install',
                startCommand: 'npm start',
                files: [
                    {
                        path: 'server.js',
                        content: `const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.json({
        message: "Hello from Docker IDE!",
        framework: "Express.js",
        endpoints: ["/api/status", "/api/items"]
    });
});

app.get('/api/status', (req, res) => {
    res.json({ 
        status: 'running', 
        uptime: process.uptime(),
        nodeVersion: process.version
    });
});

let items = [];

app.get('/api/items', (req, res) => {
    res.json({ items });
});

app.post('/api/items', (req, res) => {
    const item = { id: Date.now(), ...req.body };
    items.push(item);
    res.status(201).json(item);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(\`Server running on http://localhost:\${PORT}\`);
});
`,
                    },
                    {
                        path: 'package.json',
                        content: JSON.stringify({
                            name: "express-api",
                            version: "1.0.0",
                            main: "server.js",
                            scripts: {
                                start: "node server.js",
                                dev: "node --watch server.js"
                            },
                            dependencies: {
                                "express": "^4.18.2",
                                "cors": "^2.8.5"
                            }
                        }, null, 2),
                    },
                    {
                        path: '.docker-ide.json',
                        content: JSON.stringify({
                            framework: 'express',
                            installCommand: 'npm install',
                            startCommand: 'npm start',
                            ports: [3000],
                        }, null, 2),
                    },
                ],
            },
            {
                id: 'js-react',
                name: 'React (Vite)',
                description: 'Application React avec Vite',
                framework: 'React',
                requiresInstall: true,
                installCommand: 'npm create vite@latest . -- --template react && npm install',
                startCommand: 'npm run dev -- --host 0.0.0.0',
                files: [
                    {
                        path: '.docker-ide.json',
                        content: JSON.stringify({
                            framework: 'react',
                            installCommand: 'npm create vite@latest . -- --template react && npm install',
                            startCommand: 'npm run dev -- --host 0.0.0.0',
                            ports: [5173],
                        }, null, 2),
                    },
                    {
                        path: 'README.md',
                        content: `# Projet React (Vite)

## Installation

\`\`\`bash
npm create vite@latest . -- --template react
npm install
\`\`\`

## Démarrage

\`\`\`bash
npm run dev -- --host 0.0.0.0
\`\`\`

Le serveur de développement sera accessible sur http://localhost:5173
`,
                    },
                ],
            },
            {
                id: 'js-vue',
                name: 'Vue.js (Vite)',
                description: 'Application Vue 3 avec Vite',
                framework: 'Vue',
                requiresInstall: true,
                installCommand: 'npm create vite@latest . -- --template vue && npm install',
                startCommand: 'npm run dev -- --host 0.0.0.0',
                files: [
                    {
                        path: '.docker-ide.json',
                        content: JSON.stringify({
                            framework: 'vue',
                            installCommand: 'npm create vite@latest . -- --template vue && npm install',
                            startCommand: 'npm run dev -- --host 0.0.0.0',
                            ports: [5173],
                        }, null, 2),
                    },
                    {
                        path: 'README.md',
                        content: `# Projet Vue.js (Vite)

## Installation

\`\`\`bash
npm create vite@latest . -- --template vue
npm install
\`\`\`

## Démarrage

\`\`\`bash
npm run dev -- --host 0.0.0.0
\`\`\`
`,
                    },
                ],
            },
            {
                id: 'js-nextjs',
                name: '▲ Next.js',
                description: 'Application Next.js 14',
                framework: 'Next.js',
                requiresInstall: true,
                installCommand: 'npx create-next-app@latest . --use-npm --ts --tailwind --eslint --app --src-dir --import-alias "@/*"',
                startCommand: 'npm run dev',
                files: [
                    {
                        path: '.docker-ide.json',
                        content: JSON.stringify({
                            framework: 'nextjs',
                            installCommand: 'npx create-next-app@latest . --use-npm --ts --tailwind --eslint --app --src-dir --import-alias "@/*"',
                            startCommand: 'npm run dev',
                            ports: [3000],
                        }, null, 2),
                    },
                    {
                        path: 'README.md',
                        content: `# Projet Next.js

## Installation

\`\`\`bash
npx create-next-app@latest .
\`\`\`

## Démarrage

\`\`\`bash
npm run dev
\`\`\`

Le serveur sera accessible sur http://localhost:3000
`,
                    },
                ],
            },
            {
                id: 'js-nestjs',
                name: 'NestJS',
                description: 'Framework backend progressif',
                framework: 'NestJS',
                requiresInstall: true,
                installCommand: 'npx @nestjs/cli new . --skip-git --package-manager npm',
                startCommand: 'npm run start:dev',
                files: [
                    {
                        path: '.docker-ide.json',
                        content: JSON.stringify({
                            framework: 'nestjs',
                            installCommand: 'npx @nestjs/cli new . --skip-git --package-manager npm',
                            startCommand: 'npm run start:dev',
                            ports: [3000],
                        }, null, 2),
                    },
                    {
                        path: 'README.md',
                        content: `# Projet NestJS

## Installation

\`\`\`bash
npx @nestjs/cli new . --skip-git
\`\`\`

## Démarrage

\`\`\`bash
npm run start:dev
\`\`\`

API accessible sur http://localhost:3000
`,
                    },
                ],
            },
        ],
    },
    // =========================================
    // TypeScript
    // =========================================
    {
        id: 'typescript',
        name: 'TypeScript',
        icon: 'TS',
        image: 'node:20-alpine',
        description: 'TypeScript with ts-node',
        templates: [
            {
                id: 'ts-basic',
                name: 'Projet basique',
                description: 'TypeScript simple avec ts-node',
                requiresInstall: true,
                installCommand: 'npm install',
                files: [
                    {
                        path: 'src/index.ts',
                        content: `/**
 * Mon premier projet TypeScript dans Docker IDE
 */

interface Person {
    name: string;
    age: number;
}

function greet(person: Person): string {
    return \`Hello, \${person.name}! Tu as \${person.age} ans.\`;
}

const user: Person = { name: "Docker", age: 10 };

console.log("Hello from Docker IDE!");
console.log(greet(user));

// Exemple avec types
const numbers: number[] = [1, 2, 3, 4, 5];
const doubled: number[] = numbers.map((n): number => n * 2);
console.log("Nombres doublés:", doubled);
`,
                    },
                    {
                        path: 'package.json',
                        content: JSON.stringify({
                            name: "ts-project",
                            version: "1.0.0",
                            main: "src/index.ts",
                            scripts: {
                                start: "npx ts-node src/index.ts",
                                build: "tsc",
                                dev: "npx ts-node-dev src/index.ts"
                            },
                            devDependencies: {
                                "typescript": "^5.3.0",
                                "ts-node": "^10.9.0",
                                "@types/node": "^20.0.0"
                            }
                        }, null, 2),
                    },
                    {
                        path: 'tsconfig.json',
                        content: JSON.stringify({
                            compilerOptions: {
                                target: "ES2022",
                                module: "commonjs",
                                strict: true,
                                esModuleInterop: true,
                                skipLibCheck: true,
                                outDir: "./dist"
                            },
                            include: ["src/**/*"]
                        }, null, 2),
                    },
                ],
            },
        ],
    },
    // =========================================
    // Java - Spring Boot
    // =========================================
    {
        id: 'java',
        name: 'Java',
        icon: 'JV',
        image: 'eclipse-temurin:17-jdk',
        description: 'Java 17 LTS (Eclipse Temurin)',
        templates: [
            {
                id: 'java-basic',
                name: 'Projet basique',
                description: 'Classe Main simple',
                files: [
                    {
                        path: 'Main.java',
                        content: `/**
 * Mon premier projet Java dans Docker IDE
 */
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from Docker IDE!");
        System.out.println("Modifiez ce fichier et appuyez sur F5 pour exécuter");
        
        // Exemple avec streams
        java.util.List<Integer> numbers = java.util.Arrays.asList(1, 2, 3, 4, 5);
        System.out.println("Carrés: " + 
            numbers.stream()
                   .map(n -> n * n)
                   .toList()
        );
    }
}
`,
                    },
                ],
            },
            {
                id: 'java-spring',
                name: 'Spring Boot',
                description: 'Application Spring Boot',
                framework: 'Spring Boot',
                requiresInstall: true,
                installCommand: 'curl https://start.spring.io/starter.zip -d dependencies=web,devtools -d type=maven-project -d language=java -d bootVersion=3.2.0 -d baseDir=. -o starter.zip && unzip starter.zip && rm starter.zip',
                startCommand: './mvnw spring-boot:run',
                files: [
                    {
                        path: '.docker-ide.json',
                        content: JSON.stringify({
                            framework: 'spring-boot',
                            image: 'eclipse-temurin:17-jdk',
                            installCommand: 'curl https://start.spring.io/starter.zip -d dependencies=web,devtools -d type=maven-project -d language=java -d bootVersion=3.2.0 -o starter.zip && unzip starter.zip -d . && rm starter.zip',
                            startCommand: './mvnw spring-boot:run',
                            ports: [8080],
                        }, null, 2),
                    },
                    {
                        path: 'README.md',
                        content: `# Projet Spring Boot

## Installation

Le projet sera généré via Spring Initializr.

## Démarrage

\`\`\`bash
./mvnw spring-boot:run
\`\`\`

API accessible sur http://localhost:8080
`,
                    },
                ],
            },
            {
                id: 'java-maven',
                name: 'Maven Project',
                description: 'Projet Maven standard',
                framework: 'Maven',
                files: [
                    {
                        path: 'pom.xml',
                        content: `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.dockeride</groupId>
    <artifactId>mon-projet</artifactId>
    <version>1.0-SNAPSHOT</version>
    <packaging>jar</packaging>

    <properties>
        <maven.compiler.source>17</maven.compiler.source>
        <maven.compiler.target>17</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>

    <dependencies>
        <dependency>
            <groupId>junit</groupId>
            <artifactId>junit</artifactId>
            <version>4.13.2</version>
            <scope>test</scope>
        </dependency>
    </dependencies>
</project>
`,
                    },
                    {
                        path: 'src/main/java/com/dockeride/App.java',
                        content: `package com.dockeride;

public class App {
    public static void main(String[] args) {
        System.out.println("Hello from Docker IDE!");
    }
}
`,
                    },
                ],
            },
        ],
    },
    // =========================================
    // Go - Gin, Fiber
    // =========================================
    {
        id: 'go',
        name: 'Go',
        icon: 'GO',
        image: 'golang:1.21-alpine',
        description: 'Go 1.21',
        templates: [
            {
                id: 'go-basic',
                name: 'Projet basique',
                description: 'Package main simple',
                files: [
                    {
                        path: 'main.go',
                        content: `package main

import "fmt"

func main() {
    fmt.Println("Hello from Docker IDE!")
    fmt.Println("Modifiez ce fichier et appuyez sur F5 pour exécuter")
    
    numbers := []int{1, 2, 3, 4, 5}
    var squared []int
    for _, n := range numbers {
        squared = append(squared, n*n)
    }
    fmt.Printf("Carrés: %v\\n", squared)
}
`,
                    },
                    {
                        path: 'go.mod',
                        content: `module monprojet

go 1.21
`,
                    },
                ],
            },
            {
                id: 'go-gin',
                name: 'Gin API',
                description: 'API REST avec Gin',
                framework: 'Gin',
                requiresInstall: true,
                installCommand: 'go mod tidy',
                startCommand: 'go run main.go',
                files: [
                    {
                        path: 'main.go',
                        content: `package main

import (
    "net/http"
    "github.com/gin-gonic/gin"
)

type Item struct {
    ID   string \`json:"id"\`
    Name string \`json:"name"\`
}

var items = []Item{}

func main() {
    r := gin.Default()
    
    r.GET("/", func(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{
            "message": "Hello from Docker IDE!",
            "framework": "Gin",
        })
    })
    
    r.GET("/api/items", func(c *gin.Context) {
        c.JSON(http.StatusOK, items)
    })
    
    r.POST("/api/items", func(c *gin.Context) {
        var item Item
        if err := c.ShouldBindJSON(&item); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
            return
        }
        items = append(items, item)
        c.JSON(http.StatusCreated, item)
    })
    
    r.Run(":8080")
}
`,
                    },
                    {
                        path: 'go.mod',
                        content: `module monprojet

go 1.21

require github.com/gin-gonic/gin v1.9.1
`,
                    },
                    {
                        path: '.docker-ide.json',
                        content: JSON.stringify({
                            framework: 'gin',
                            installCommand: 'go mod tidy',
                            startCommand: 'go run main.go',
                            ports: [8080],
                        }, null, 2),
                    },
                ],
            },
            {
                id: 'go-fiber',
                name: 'Fiber API',
                description: 'API ultra-rapide avec Fiber',
                framework: 'Fiber',
                requiresInstall: true,
                installCommand: 'go mod tidy',
                startCommand: 'go run main.go',
                files: [
                    {
                        path: 'main.go',
                        content: `package main

import (
    "github.com/gofiber/fiber/v2"
)

func main() {
    app := fiber.New()

    app.Get("/", func(c *fiber.Ctx) error {
        return c.JSON(fiber.Map{
            "message":   "Hello from Docker IDE!",
            "framework": "Fiber",
        })
    })

    app.Get("/api/status", func(c *fiber.Ctx) error {
        return c.JSON(fiber.Map{
            "status": "running",
        })
    })

    app.Listen(":3000")
}
`,
                    },
                    {
                        path: 'go.mod',
                        content: `module monprojet

go 1.21

require github.com/gofiber/fiber/v2 v2.51.0
`,
                    },
                    {
                        path: '.docker-ide.json',
                        content: JSON.stringify({
                            framework: 'fiber',
                            installCommand: 'go mod tidy',
                            startCommand: 'go run main.go',
                            ports: [3000],
                        }, null, 2),
                    },
                ],
            },
        ],
    },
    // =========================================
    // Rust - Actix, Rocket
    // =========================================
    {
        id: 'rust',
        name: 'Rust',
        icon: 'RS',
        image: 'rust:1.73-slim',
        description: 'Rust stable',
        templates: [
            {
                id: 'rust-basic',
                name: 'Projet basique',
                description: 'Fichier main.rs simple',
                files: [
                    {
                        path: 'main.rs',
                        content: `//! Mon premier projet Rust dans Docker IDE

fn main() {
    println!("Hello from Docker IDE!");
    println!("Modifiez ce fichier et appuyez sur F5 pour exécuter");
    
    let numbers: Vec<i32> = vec![1, 2, 3, 4, 5];
    let squared: Vec<i32> = numbers.iter().map(|n| n * n).collect();
    println!("Carrés: {:?}", squared);
}
`,
                    },
                ],
            },
            {
                id: 'rust-actix',
                name: 'Actix Web',
                description: 'API REST avec Actix',
                framework: 'Actix',
                requiresInstall: true,
                installCommand: 'cargo build',
                startCommand: 'cargo run',
                files: [
                    {
                        path: 'Cargo.toml',
                        content: `[package]
name = "mon-projet"
version = "0.1.0"
edition = "2021"

[dependencies]
actix-web = "4"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1", features = ["full"] }
`,
                    },
                    {
                        path: 'src/main.rs',
                        content: `use actix_web::{get, post, web, App, HttpResponse, HttpServer, Responder};
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct Status {
    message: String,
    framework: String,
}

#[get("/")]
async fn index() -> impl Responder {
    HttpResponse::Ok().json(Status {
        message: "Hello from Docker IDE!".to_string(),
        framework: "Actix Web".to_string(),
    })
}

#[get("/api/status")]
async fn status() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "running"
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    println!("Server running on http://localhost:8080");
    
    HttpServer::new(|| {
        App::new()
            .service(index)
            .service(status)
    })
    .bind("0.0.0.0:8080")?
    .run()
    .await
}
`,
                    },
                    {
                        path: '.docker-ide.json',
                        content: JSON.stringify({
                            framework: 'actix',
                            installCommand: 'cargo build',
                            startCommand: 'cargo run',
                            ports: [8080],
                        }, null, 2),
                    },
                ],
            },
        ],
    },
    // =========================================
    // Ruby - Rails, Sinatra
    // =========================================
    {
        id: 'ruby',
        name: 'Ruby',
        icon: 'RB',
        image: 'ruby:3.2-slim',
        description: 'Ruby 3.2',
        templates: [
            {
                id: 'ruby-basic',
                name: 'Projet basique',
                description: 'Fichier main.rb simple',
                files: [
                    {
                        path: 'main.rb',
                        content: `#!/usr/bin/env ruby
# Mon premier projet Ruby dans Docker IDE

puts "Hello from Docker IDE!"
puts "Modifiez ce fichier et appuyez sur F5 pour exécuter"

numbers = [1, 2, 3, 4, 5]
doubled = numbers.map { |n| n * 2 }
puts "Nombres doublés: #{doubled}"
`,
                    },
                ],
            },
            {
                id: 'ruby-sinatra',
                name: 'Sinatra',
                description: 'API légère avec Sinatra',
                framework: 'Sinatra',
                requiresInstall: true,
                installCommand: 'bundle install',
                startCommand: 'ruby app.rb',
                files: [
                    {
                        path: 'app.rb',
                        content: `require 'sinatra'
require 'json'

set :bind, '0.0.0.0'
set :port, 4567

get '/' do
  content_type :json
  {
    message: "Hello from Docker IDE!",
    framework: "Sinatra"
  }.to_json
end

get '/api/status' do
  content_type :json
  { status: 'running' }.to_json
end
`,
                    },
                    {
                        path: 'Gemfile',
                        content: `source 'https://rubygems.org'

gem 'sinatra'
gem 'rackup'
gem 'puma'
`,
                    },
                    {
                        path: '.docker-ide.json',
                        content: JSON.stringify({
                            framework: 'sinatra',
                            installCommand: 'bundle install',
                            startCommand: 'ruby app.rb',
                            ports: [4567],
                        }, null, 2),
                    },
                ],
            },
            {
                id: 'ruby-rails',
                name: 'Ruby on Rails',
                description: 'Application Rails complète',
                framework: 'Rails',
                requiresInstall: true,
                installCommand: 'gem install rails && rails new . --api --skip-git',
                startCommand: 'rails server -b 0.0.0.0',
                files: [
                    {
                        path: '.docker-ide.json',
                        content: JSON.stringify({
                            framework: 'rails',
                            installCommand: 'gem install rails && rails new . --api --skip-git',
                            startCommand: 'rails server -b 0.0.0.0',
                            ports: [3000],
                        }, null, 2),
                    },
                    {
                        path: 'README.md',
                        content: `# Projet Ruby on Rails

## Installation

\`\`\`bash
gem install rails
rails new . --api
\`\`\`

## Démarrage

\`\`\`bash
rails server -b 0.0.0.0
\`\`\`
`,
                    },
                ],
            },
        ],
    },
    // =========================================
    // Docker Compose - Multi-service projects
    // =========================================
    {
        id: 'compose',
        name: 'Docker Compose',
        icon: 'DC',
        image: 'docker:cli',
        description: 'Multi-service projects with docker-compose',
        templates: [
            {
                id: 'compose-web-db',
                name: 'Web + Database',
                description: 'Web application with PostgreSQL database',
                files: [
                    {
                        path: 'docker-compose.yml',
                        content: `services:
  app:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - .:/app
    ports:
      - "3000:3000"
    depends_on:
      - db
    environment:
      DATABASE_URL: \${DATABASE_URL:-postgres://app_user:changeme@db:5432/app}
    command: sh -c "npm install && node index.js"

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: \${POSTGRES_USER:-app_user}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-changeme}
      POSTGRES_DB: \${POSTGRES_DB:-app}
    volumes:
      - db_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  db_data:
`,
                    },
                    {
                        path: 'index.js',
                        content: `const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        message: 'Hello from Docker Compose!',
        database: process.env.DATABASE_URL ? 'configured' : 'not configured',
    }));
});

server.listen(3000, '0.0.0.0', () => {
    console.log('Server running on http://localhost:3000');
});
`,
                    },
                    {
                        path: 'package.json',
                        content: JSON.stringify({
                            name: 'compose-app',
                            version: '1.0.0',
                            main: 'index.js',
                            scripts: { start: 'node index.js' },
                        }, null, 2),
                    },
                    {
                        path: '.docker-ide.json',
                        content: JSON.stringify({
                            language: 'javascript',
                            image: 'node:20-alpine',
                            compose: true,
                        }, null, 2),
                    },
                ],
            },
            {
                id: 'compose-fullstack',
                name: 'Fullstack (Front + Back + DB)',
                description: 'Frontend, backend API, and database',
                files: [
                    {
                        path: 'docker-compose.yml',
                        content: `services:
  frontend:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - ./frontend:/app
    ports:
      - "5173:5173"
    command: sh -c "npm install && npm run dev -- --host 0.0.0.0"

  backend:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - ./backend:/app
    ports:
      - "3000:3000"
    depends_on:
      - db
    environment:
      DATABASE_URL: \${DATABASE_URL:-postgres://app_user:changeme@db:5432/app}
    command: sh -c "npm install && node index.js"

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: \${POSTGRES_USER:-app_user}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-changeme}
      POSTGRES_DB: \${POSTGRES_DB:-app}
    volumes:
      - db_data:/var/lib/postgresql/data

volumes:
  db_data:
`,
                    },
                    {
                        path: 'backend/index.js',
                        content: `const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'http://localhost:5173',
    });
    res.end(JSON.stringify({ message: 'Backend API running' }));
});

server.listen(3000, '0.0.0.0', () => {
    console.log('Backend running on port 3000');
});
`,
                    },
                    {
                        path: 'backend/package.json',
                        content: JSON.stringify({
                            name: 'backend',
                            version: '1.0.0',
                            main: 'index.js',
                            scripts: { start: 'node index.js' },
                        }, null, 2),
                    },
                    {
                        path: 'frontend/index.html',
                        content: `<!DOCTYPE html>
<html>
<head><title>App</title></head>
<body>
  <h1>Fullstack Docker Compose App</h1>
  <div id="api-response"></div>
  <script>
    fetch('http://localhost:3000')
      .then(r => r.json())
      .then(data => {
        document.getElementById('api-response').textContent = JSON.stringify(data);
      });
  </script>
</body>
</html>`,
                    },
                    {
                        path: '.docker-ide.json',
                        content: JSON.stringify({
                            language: 'javascript',
                            image: 'node:20-alpine',
                            compose: true,
                        }, null, 2),
                    },
                ],
            },
        ],
    },
];

const ProjectCreatorModal: React.FC<ProjectCreatorProps> = ({
    isOpen,
    onClose,
    onProjectCreated,
}) => {
    const [step, setStep] = useState<'language' | 'template' | 'location' | 'installing'>('language');
    const [projectName, setProjectName] = useState('mon-projet');
    const [selectedLanguage, setSelectedLanguage] = useState<LanguageTemplate | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
    const [projectPath, setProjectPath] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Installation state
    const [installProgress, setInstallProgress] = useState('');
    const [installOutput, setInstallOutput] = useState<string[]>([]);
    const [installComplete, setInstallComplete] = useState(false);
    const [installError, setInstallError] = useState<string | null>(null);
    const outputRef = useRef<HTMLDivElement>(null);

    // Listen for installation events
    useEffect(() => {
        const handleProgress = (data: { status: string }) => {
            setInstallProgress(data.status);
        };

        const handleOutput = (data: { data: string }) => {
            setInstallOutput(prev => [...prev, data.data]);
        };

        const cleanupProgress = window.electronAPI.runner.onSetupProgress(handleProgress);
        const cleanupOutput = window.electronAPI.runner.onSetupOutput(handleOutput);

        return () => {
            cleanupProgress?.();
            cleanupOutput?.();
        };
    }, []);

    // Auto-scroll output
    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [installOutput]);

    const handleSelectLanguage = (lang: LanguageTemplate) => {
        setSelectedLanguage(lang);
        setSelectedTemplate(lang.templates[0]);
        setStep('template');
    };

    const handleSelectTemplate = (template: ProjectTemplate) => {
        setSelectedTemplate(template);
        setStep('location');
    };

    const handleBrowseFolder = async () => {
        try {
            const result = await window.electronAPI.fs.openFolder();
            if (result.success && result.path) {
                setProjectPath(result.path);
            }
        } catch (err) {
            console.error('Error selecting folder:', err);
        }
    };

    const handleCreateProject = async () => {
        if (!selectedLanguage || !selectedTemplate || !projectPath || !projectName) {
            setError('Veuillez remplir tous les champs');
            return;
        }

        setIsCreating(true);
        setError(null);

        try {
            // Create project directory
            const fullProjectPath = `${projectPath}/${projectName}`;
            await window.electronAPI.fs.createDirectory(fullProjectPath);

            // If framework requires installation, DON'T create files before (Composer needs empty dir)
            if (selectedTemplate.requiresInstall && selectedTemplate.installCommand) {
                // Switch to installation step
                setStep('installing');
                setInstallOutput([]);
                setInstallProgress('Starting installation...');
                setInstallComplete(false);
                setInstallError(null);

                // Determine which image to use for setup
                const setupImage = selectedTemplate.setupImage || selectedLanguage.image;

                try {
                    const result = await window.electronAPI.runner.setupFramework({
                        projectPath: fullProjectPath,
                        image: setupImage,
                        installCommand: selectedTemplate.installCommand,
                    });

                    if (result.success) {
                        // Now create template files AFTER successful installation
                        setInstallProgress('Adding configuration files...');
                        for (const file of selectedTemplate.files) {
                            const filePath = `${fullProjectPath}/${file.path}`;
                            await window.electronAPI.fs.writeFile(filePath, file.content);
                        }

                        // Always create/update .docker-ide.json with language info
                        const dockerIdeConfig = {
                            language: selectedLanguage.id,
                            image: selectedLanguage.image,
                            framework: selectedTemplate.framework || null,
                            template: selectedTemplate.id,
                            createdAt: new Date().toISOString(),
                        };
                        await window.electronAPI.fs.writeFile(
                            `${fullProjectPath}/.docker-ide.json`,
                            JSON.stringify(dockerIdeConfig, null, 2)
                        );

                        setInstallComplete(true);
                        setInstallProgress('Installation completed successfully');
                        // Wait a bit then open project
                        setTimeout(() => {
                            onProjectCreated(fullProjectPath);
                            handleClose();
                        }, 1500);
                    } else {
                        setInstallError(result.error || 'Erreur lors de l\'installation');
                        setInstallProgress('Installation failed');
                    }
                } catch (err: any) {
                    setInstallError(err.message);
                    setInstallProgress('Unexpected error');
                }
            } else {
                // No installation needed, create template files first
                for (const file of selectedTemplate.files) {
                    const filePath = `${fullProjectPath}/${file.path}`;
                    await window.electronAPI.fs.writeFile(filePath, file.content);
                }

                // Always create .docker-ide.json with language info
                const dockerIdeConfig = {
                    language: selectedLanguage.id,
                    image: selectedLanguage.image,
                    framework: selectedTemplate.framework || null,
                    template: selectedTemplate.id,
                    createdAt: new Date().toISOString(),
                };
                await window.electronAPI.fs.writeFile(
                    `${fullProjectPath}/.docker-ide.json`,
                    JSON.stringify(dockerIdeConfig, null, 2)
                );

                onProjectCreated(fullProjectPath);
                handleClose();
            }
        } catch (err: any) {
            setError(err.message || 'Erreur lors de la création du projet');
        } finally {
            setIsCreating(false);
        }
    };

    const handleClose = () => {
        setStep('language');
        setProjectName('mon-projet');
        setSelectedLanguage(null);
        setSelectedTemplate(null);
        setProjectPath('');
        setError(null);
        setInstallOutput([]);
        setInstallProgress('');
        setInstallComplete(false);
        setInstallError(null);
        onClose();
    };

    const handleBack = () => {
        if (step === 'template') {
            setStep('language');
        } else if (step === 'location') {
            setStep('template');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-content project-creator" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>
                        {step === 'language' && 'New Project'}
                        {step === 'template' && `${selectedLanguage?.icon} ${selectedLanguage?.name}`}
                        {step === 'location' && 'Location'}
                    </h2>
                    <button className="modal-close" onClick={handleClose}>×</button>
                </div>

                <div className="modal-body">
                    {/* Step 1: Choose Language */}
                    {step === 'language' && (
                        <div className="language-grid">
                            {LANGUAGE_TEMPLATES.map((lang) => (
                                <div
                                    key={lang.id}
                                    className="language-card"
                                    onClick={() => handleSelectLanguage(lang)}
                                >
                                    <span className="language-icon">{lang.icon}</span>
                                    <h3>{lang.name}</h3>
                                    <p>{lang.description}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Step 2: Choose Template */}
                    {step === 'template' && selectedLanguage && (
                        <div className="template-list">
                            {selectedLanguage.templates.map((template) => (
                                <div
                                    key={template.id}
                                    className={`template-card ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
                                    onClick={() => handleSelectTemplate(template)}
                                >
                                    <div className="template-header">
                                        <h3>{template.name}</h3>
                                        {template.framework && (
                                            <span className="framework-badge">{template.framework}</span>
                                        )}
                                    </div>
                                    <p>{template.description}</p>
                                    {template.requiresInstall && (
                                        <div className="template-install-info">
                                            <span className="install-badge">Setup required</span>
                                        </div>
                                    )}
                                    <div className="template-files">
                                        {template.files.slice(0, 3).map((f) => (
                                            <span key={f.path} className="file-tag">
                                                {f.path}
                                            </span>
                                        ))}
                                        {template.files.length > 3 && (
                                            <span className="file-tag more">+{template.files.length - 3}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Step 3: Choose Location */}
                    {step === 'location' && (
                        <div className="location-form">
                            <div className="form-group">
                                <label>Nom du projet</label>
                                <input
                                    type="text"
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value.replace(/[^a-zA-Z0-9-_]/g, '-'))}
                                    placeholder="mon-projet"
                                />
                            </div>
                            <div className="form-group">
                                <label>Emplacement</label>
                                <div className="path-input">
                                    <input
                                        type="text"
                                        value={projectPath}
                                        onChange={(e) => setProjectPath(e.target.value)}
                                        placeholder="Sélectionnez un dossier..."
                                        readOnly
                                    />
                                    <button onClick={handleBrowseFolder}>Parcourir...</button>
                                </div>
                            </div>
                            {projectPath && (
                                <div className="project-preview">
                                    <p>Le projet sera créé dans :</p>
                                    <code>{projectPath}/{projectName}</code>
                                </div>
                            )}
                            {selectedTemplate?.requiresInstall && (
                                <div className="install-notice-box">
                                    <span className="install-icon">i</span>
                                    <div className="install-info">
                                        <strong>Installation automatique</strong>
                                        <p>Les dépendances du framework {selectedTemplate.framework} seront installées automatiquement via Docker.</p>
                                        <code>{selectedTemplate.installCommand}</code>
                                    </div>
                                </div>
                            )}
                            {error && <div className="form-error">{error}</div>}
                        </div>
                    )}

                    {/* Step 4: Installation Progress */}
                    {step === 'installing' && (
                        <div className="installation-progress">
                            <div className="install-header">
                                <span className={`install-spinner ${installComplete ? 'done' : ''}`}>{installComplete ? '\u2713' : ''}</span>
                                <h3>{installProgress}</h3>
                            </div>
                            
                            <div className="install-output" ref={outputRef}>
                                {installOutput.map((line, idx) => (
                                    <div key={idx} className="output-line">{line}</div>
                                ))}
                                {installOutput.length === 0 && !installError && (
                                    <div className="output-placeholder">
                                        En attente de la sortie...
                                    </div>
                                )}
                            </div>

                            {installError && (
                                <div className="install-error">
                                    <strong>Error:</strong> {installError}
                                    <button 
                                        className="btn btn-secondary btn-small"
                                        onClick={() => {
                                            setStep('location');
                                            setInstallError(null);
                                        }}
                                    >
                                        Réessayer
                                    </button>
                                </div>
                            )}

                            {installComplete && (
                                <div className="install-success">
                                    <p>Your {selectedTemplate?.framework} project is ready.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    {step !== 'language' && step !== 'installing' && (
                        <button className="btn btn-secondary" onClick={handleBack}>
                            ← Retour
                        </button>
                    )}
                    <div className="modal-footer-right">
                        {step !== 'installing' && (
                            <button className="btn btn-secondary" onClick={handleClose}>
                                Annuler
                            </button>
                        )}
                        {step === 'location' && (
                            <button
                                className="btn btn-primary"
                                onClick={handleCreateProject}
                                disabled={isCreating || !projectPath || !projectName}
                            >
                                {isCreating ? 'Creating...' : selectedTemplate?.requiresInstall ? 'Create & Install' : 'Create Project'}
                            </button>
                        )}
                        {step === 'installing' && installComplete && (
                            <button className="btn btn-primary" onClick={handleClose}>
                                Fermer
                            </button>
                        )}
                        {step === 'installing' && installError && (
                            <button className="btn btn-secondary" onClick={handleClose}>
                                Fermer
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectCreatorModal;
