async function fetchStudents() {
const response = await fetch('http://localhost:3001/api/articles/manual-upload'); // Actualizar a la URL real
    const students = await response.json();
    return students.filter(student => student.role === 'student'); // Filtrar solo estudiantes
}

document.getElementById("searchButton").addEventListener("click", async function() {
    const input = document.getElementById("searchInput").value.toLowerCase();
    const resultsDiv = document.getElementById("results");
    resultsDiv.innerHTML = ""; // Limpiar resultados anteriores

    const students = await fetchStudents(); // Obtener estudiantes reales
    const filteredStudents = students.filter(student => student.username.toLowerCase().includes(input));

    if (filteredStudents.length > 0) {
        filteredStudents.forEach(student => {
            const div = document.createElement("div");
            div.textContent = student.username; // Mostrar el nombre del estudiante
            
            // Añadir botón para ver estadísticas
            const statsButton = document.createElement("button");
            statsButton.textContent = "Ver Estadísticas";
            statsButton.addEventListener("click", async () => {
                const stats = await fetchStudentStats(student.id); // Obtener estadísticas del estudiante
                const statsDiv = document.getElementById("student-stats");
                statsDiv.innerHTML = `
                    <h3>Estadísticas de ${student.username}</h3>
                    <p>Artículos Leídos: ${stats.articlesRead}</p>
                    <p>Quizzes Tomados: ${stats.quizzesTaken}</p>
                    <p>Vocabulario Aprendido: ${stats.vocabularyLearned}</p>
                    <p>Racha Actual: ${stats.streak}</p>
                `;
            });
            div.appendChild(statsButton);
            resultsDiv.appendChild(div);
        });
    } else {
        resultsDiv.textContent = "No se encontraron resultados.";
    }
});

async function fetchStudentStats(studentId) {
    const response = await fetch(`http://localhost:3001/api/users/${studentId}`); // Suponiendo que esta es la ruta para obtener estadísticas del estudiante
    return await response.json();
}

document.getElementById("submitTaskButton").addEventListener("click", async function() {
    const data = {
        title: document.getElementById('title').value,
        topic: document.getElementById('topic').value,
        content: document.getElementById('content').value
    };

    const res = await fetch('http://localhost:3001/api/articles/manual-upload', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify(data)
    });

    const msg = document.getElementById('status-msg');
    if (res.ok) {
        msg.style.color = "green";
        msg.innerText = "✅ Artículo publicado con éxito!";
    } else {
        msg.style.color = "red";
        msg.innerText = "❌ Error al publicar el artículo.";
    }
});