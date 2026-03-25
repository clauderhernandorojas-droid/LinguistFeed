// js/mockData.js

export const MOCK_ARTICLES = {
    "A2": {
        title: "Water on Mars: A Big Discovery",
        content: `NASA scientists found water on Mars. Mars is a very cold and dry planet. It is like a big desert. 
                  However, new photos show dark lines on the ground. These lines appear in the summer. 
                  
                  This is good news for astronauts. In the future, people want to live there. 
                  But there is a problem: the water is very salty. You cannot drink it now. 
                  Scientists need to clean the water first.`,
        quiz: [
            {
                type: "multiple",
                question: "Is Mars a hot planet?",
                options: ["Yes, it is", "No, it is a cold desert", "It is like a forest"],
                answer: 1
            },
            {
                type: "true-false",
                question: "NASA found water on Mars.",
                answer: true
            },
            {
                type: "fill-blank",
                question: "In the future, people want to ______ on Mars.",
                answer: "live"
            }
        ]
    },
    "B1": {
        title: "NASA Confirms Evidence of Liquid Water on Mars",
        content: `NASA has discovered fresh evidence of liquid water on the Red Planet. Although Mars is mostly a frozen desert, 
                  new satellite images show dark streaks that appear during the Martian summer. 
                  
                  This discovery is essential for future missions. If there is water, there might be a chance to find life. 
                  However, the water is extremely salty, so humans cannot drink it without a special process. 
                  Astronauts will need advanced technology to use this water in the future.`,
        quiz: [
            {
                type: "multiple",
                question: "What do the new satellite images show?",
                options: ["Green plants", "Dark streaks of water", "Martian cities"],
                answer: 1
            },
            {
                type: "true-false",
                question: "Humans can drink the water found on Mars immediately.",
                answer: false
            },
            {
                type: "fill-blank",
                question: "The water on Mars is very ______.",
                answer: "salty"
            }
        ]
    },
    "B2": {
        title: "Breakthrough: Seasonal Water Flows Identified on Martian Surface",
        content: `In a landmark discovery, NASA researchers have identified seasonal flows of liquid brine on Mars. 
                  Using high-resolution imaging, scientists observed dark, narrow streaks called 'Recurring Slope Lineae'. 
                  These features lengthen during warm seasons and fade when temperatures drop.
                  
                  The presence of liquid water raises significant questions about planetary habitability. 
                  Furthermore, this finding could drastically reduce the cost of future manned missions, 
                  as water is a critical resource for life support and fuel production. Nevertheless, 
                  the high salinity of the brine poses a significant challenge for immediate consumption.`,
        quiz: [
            {
                type: "multiple",
                question: "What is the technical name for the dark streaks?",
                options: ["Martian Rivers", "Recurring Slope Lineae", "Summer Shadows"],
                answer: 1
            },
            {
                type: "true-false",
                question: "The streaks disappear when the temperature drops.",
                answer: true
            },
            {
                type: "fill-blank",
                question: "The discovery of water is a critical resource for life support and ______ production.",
                answer: "fuel"
            }
        ]
    }
};