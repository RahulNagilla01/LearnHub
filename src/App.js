import React, { useState, useEffect } from "react";
import jsPDF from "jspdf";
import "./App.css";

const YOUTUBE_API_KEY = "Your youtube api"; // Replace with your actual YouTube API key
const GEMINI_API_KEY = "Your gemini api"; // Replace with your actual Gemini API key

const App = () => {
  const [query, setQuery] = useState("");
  const [resources, setResources] = useState([]);
  const [activeTab, setActiveTab] = useState("all");
  const [currentPage, setCurrentPage] = useState("home");
  const [searchProgress, setSearchProgress] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Search progress animation
  useEffect(() => {
    let interval;
    if (isSearching) {
      interval = setInterval(() => {
        setSearchProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 10;
        });
      }, 300);
    }
    return () => clearInterval(interval);
  }, [isSearching]);

  const fetchYouTubeResources = async (query) => {
    try {
      const searchQuery = `learn ${query}`;
      console.log(query);
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=${encodeURIComponent(
        searchQuery
      )}&type=video,playlist&key=${YOUTUBE_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (!data.items) return [];

      return data.items.map((item) => ({
        id: item.id.videoId || item.id.playlistId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.medium.url,
        channel: item.snippet.channelTitle,
        type: item.id.kind.includes("playlist") ? "playlist" : "video",
        link:
          item.id.kind.includes("playlist")
            ? `https://www.youtube.com/playlist?list=${item.id.playlistId}`
            : `https://www.youtube.com/watch?v=${item.id.videoId}`,
      }));
    } catch (error) {
      console.error("Error fetching YouTube resources:", error);
      return [];
    }
  };

  const fetchCourses = async (query) => {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: `List free online courses about ${query} with their names and valid links.` }],
              },
            ],
          }),
        }
      );
  
      const data = await response.json();
  
      if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        const coursesText = data.candidates[0].content.parts[0].text;
        const coursePattern = /\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g;
        const coursesArray = [];
  
        let match;
        while ((match = coursePattern.exec(coursesText)) !== null) {
          let courseLink = match[2].trim();
          
          // Ensure the link starts with "http://" or "https://"
          if (!courseLink.startsWith("http://") && !courseLink.startsWith("https://")) {
            courseLink = `https://${courseLink}`;
          }
  
          coursesArray.push({
            id: `course-${coursesArray.length + 1}`,
            title: match[1].trim(),
            link: courseLink,
            type: "course",
          });
        }
  
        return coursesArray.length > 0 ? coursesArray : [];
      }
      return [];
    } catch (error) {
      console.error("Error fetching course data:", error);
      return [];
    }
  };  

  const splitTextIntoPages = (pdf, text, maxWidth, lineHeight) => {
    const margin = 10;
    let yPosition = 20;
    const pageHeight = pdf.internal.pageSize.height - 20;
    const lines = pdf.splitTextToSize(text, maxWidth);
  
    lines.forEach((line) => {
      if (yPosition + lineHeight > pageHeight) {
        pdf.addPage();
        yPosition = 20;
      }
      pdf.text(line, margin, yPosition);
      yPosition += lineHeight;
    });
  
    return pdf;
  };  

  const fetchDetailedGeminiInfo = async (query) => {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `Provide a detailed, structured study guide on ${query}.
                    Sections:
                    1. Introduction
                    2. Key Concepts & Definitions
                    3. Step-by-Step Learning Path
                    4. Recommended Books & Courses
                    5. Hands-on Projects & Practice Problems
                    6. Advanced Topics
                    7. FAQs and Additional Resources
                    Format the response as readable paragraphs.`,
                  },
                ],
              },
            ],
          }),
        }
      );
  
      const data = await response.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No information found.";
    } catch (error) {
      console.error("Error fetching Gemini data:", error);
      return "Failed to fetch information.";
    }
  };
  
  const generatePDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const info = await fetchDetailedGeminiInfo(query);
      const pdf = new jsPDF();
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.text(`Study Guide: ${query}`, 10, 10);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(12);
      splitTextIntoPages(pdf, info, 180, 7);
      pdf.save(`${query}_study_guide.pdf`);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleSearch = async () => {
    if (!query.trim() || isSearching) return;

    setIsSearching(true);
    setSearchProgress(0);

    try {
      const youtubeData = await fetchYouTubeResources(query);
      const coursesData = await fetchCourses(query);
      setResources([...youtubeData, ...coursesData]);
      setCurrentPage("results");
    } finally {
      setSearchProgress(100);
      setTimeout(() => {
        setIsSearching(false);
        setSearchProgress(0);
      }, 500);
    }
  };

  const filteredResources = () => {
    if (activeTab === "all") return resources;
    return resources.filter((resource) => resource.type === activeTab);
  };

  return (
    <div className="App">
      <nav className="navbar">
        <div className="navbar-title">Learn Hub</div>
        <div className="navbar-links">
          <button 
            className={currentPage === "home" ? "active" : ""} 
            onClick={() => setCurrentPage("home")}
          >
            Home
          </button>
          <button 
            className={currentPage === "about" ? "active" : ""} 
            onClick={() => setCurrentPage("about")}
          >
            About
          </button>
        </div>
      </nav>

      {currentPage === "home" && (
        <div className="home-page">
          <h1>Find the Best Free Learning Resources</h1>
          <p>Discover videos, tutorials, courses, and other educational content from across the web - all in one place.</p>
          <div className="search-container">
            <input 
              type="text" 
              value={query} 
              onChange={(e) => setQuery(e.target.value)} 
              placeholder="What would you like to learn today?" 
            />
            <button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
          {isSearching && (
            <div className="search-progress-container">
              <div 
                className="search-progress-bar" 
                style={{ width: `${searchProgress}%` }}
              ></div>
            </div>
          )}
          <div className="resource-section">
            <div className="resource-card">
              <div className="icon">📹</div>
              <h3>Video Tutorials</h3>
              <p>Access thousands of free video tutorials and courses from YouTube and other platforms.</p>
            </div>
            <div className="resource-card">
              <div className="icon">📖</div>
              <h3>Topic notes</h3>
              <p>Discover comprehensive guides and tutorials from educational websites like GeeksForGeeks, MDN, and more.</p>
            </div>
            <div className="resource-card">
              <div className="icon">🎓</div>
              <h3>Free Courses</h3>
              <p>Find completely free courses from platforms like Coursera, edX, and freeCodeCamp.</p>
            </div>
          </div>
        </div>
      )}

      {currentPage === "about" && (
        <div className="about-page">
          <h1>About This Learning Hub</h1>
          <p>
            Welcome to our Learning Hub, your one-stop platform for discovering the best free educational resources.
            Whether you're a beginner or an expert, we gather high-quality learning materials from multiple sources 
            to help you improve your skills.
          </p>
          <h2>🌟 What We Offer?</h2>
          <ul>
            <li>📹 Video Tutorials: Get structured courses and lessons from YouTube.</li>
            <li>🎓 Free Courses: Find high-quality free courses from platforms like Coursera, edX, and freeCodeCamp.</li>
            <li>📖 Learning Articles: Access in-depth guides and tutorials from trusted sources.</li>
            <li>📄 Study Guides: Generate custom study guides for any topic with AI assistance.</li>
          </ul>
          <h2>🔍 Our Mission</h2>
          <p>
            Our mission is to make learning accessible to everyone. We believe that knowledge should be free and 
            easily available. By aggregating top-quality resources, we aim to provide a streamlined learning experience.
          </p>
          <h2>📬 Get in Touch</h2>
          <p>
            Have suggestions or feedback? Reach out to us at <strong>support@learninghub.com</strong>. 
            We'd love to hear from you!
          </p>
        </div>
      )}

      {currentPage === "results" && (
        <div className="results-container">
          <div className="search-container">
            <input 
              type="text" 
              value={query} 
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for more resources..."
            />
            <button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
          {isSearching && (
            <div className="search-progress-container">
              <div 
                className="search-progress-bar" 
                style={{ width: `${searchProgress}%` }}
              ></div>
            </div>
          )}

          <div className="results-header">
            <div className="tabs">
              <button className={activeTab === "all" ? "active" : ""} onClick={() => setActiveTab("all")}>All</button>
              <button className={activeTab === "video" ? "active" : ""} onClick={() => setActiveTab("video")}>Videos</button>
              <button className={activeTab === "playlist" ? "active" : ""} onClick={() => setActiveTab("playlist")}>Playlists</button>
              <button className={activeTab === "course" ? "active" : ""} onClick={() => setActiveTab("course")}>Courses</button>
            </div>

            <button 
              className="generate-pdf-button" 
              onClick={generatePDF}
              disabled={isGeneratingPDF}
            >
              {isGeneratingPDF ? 'Generating...' : '📄 Generate Study Guide (PDF)'}
            </button>
          </div>

          {isGeneratingPDF && (
            <div className="pdf-progress-container">
              <div className="pdf-progress-bar"></div>
            </div>
          )}

          <h2 className="results-title">Results for "{query}"</h2>

          <div className="results-grid">
            {filteredResources().map((resource) => (
              <div key={resource.id} className="result-item" data-type={resource.type}>
                {resource.thumbnail && <img src={resource.thumbnail} alt={resource.title} />}
                <div className="item-details">
                  <h3>{resource.title}</h3>
                  <div className="meta-info">
                    {resource.channel && <span className="channel">{resource.channel}</span>}
                  </div>
                  <a href={resource.link} target="_blank" rel="noopener noreferrer">
                      {resource.type === "playlist" ? "View Playlist" : 
                       resource.type === "course" ? "Enroll Now" : "Watch Video"}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
