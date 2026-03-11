const fs = require('fs');
const path = require('path');

// List of all image paths from winners.json
const imagePaths = [
    'images/100m_race_cse.jpeg',
    'images/badminton_cse.jpg',
    'images/dance_cse.jpg',
    'images/coding_cse.jpg',
    'images/200m_race_cse_2025.jpg',
    'images/singing_cse_2025.jpg',
    'images/tech_project_cse_2025.jpg',
    'images/200m_race_csm.jpg',
    'images/poetry_csm.jpg',
    'images/quiz_csm.jpg',
    'images/table_tennis_ece.jpg',
    'images/singing_ece.jpg',
    'images/tech_project_ece.jpg',
    'images/chess_mech.jpg',
    'images/poetry_mech.jpg',
    'images/group_discussion_mech.jpg',
    'images/badminton_civil.jpg',
    'images/dance_civil.jpg',
    'images/quiz_civil.jpg'
];

// Create images directory if it doesn't exist
if (!fs.existsSync('images')) {
    fs.mkdirSync('images');
}

// Generate placeholder images
imagePaths.forEach(imagePath => {
    const fullPath = path.join(__dirname, imagePath);
    const dir = path.dirname(fullPath);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    // Create a simple text file as a placeholder
    const imageName = path.basename(imagePath);
    const placeholderText = `Placeholder for ${imageName}`;
    fs.writeFileSync(fullPath, placeholderText);
    
    console.log(`Created placeholder for: ${imagePath}`);
}); 