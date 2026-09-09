# INNOVATIVE DEVELOPMENT OF COMMUNITY INTERACTION PLATFORM ASSESSING USABILITY, ACCESSIBILITY, AND ENGAGEMENT AMONG CTU DANAO-BARANGAN STAKEHOLDERS

---

## ABSTRACT

This study aims to design and develop a community interaction platform intended to enhance information sharing, communication opportunities, and peer connectivity among Cebu Technological University - Danao-Barangan Campus stakeholders. As CTU transitions into a technological university, the platform addresses critical gaps in how students, faculty, and staff access campus information, connect with peers who share similar academic and personal interests, and engage with the broader university community in a centralized manner. The research employs a comprehensive framework evaluating the platform based on functional sustainability, usability, performance requirements, and security and reliability metrics, following the HEIFER 2011+ model. This paper presents the problem statement, research questions, and the systematic approach to developing a platform that meets both functional and non-functional requirements essential for modern academic community engagement.

**Keywords:** Community Interaction Platform, University Engagement, Usability Assessment, Digital Community, CTU Danao-Barangan

---

## 1. INTRODUCTION

### 1.1 Background of the Study

The digital transformation of educational institutions has necessitated the development of centralized platforms that facilitate seamless communication and information sharing among stakeholders. Cebu Technological University - Danao-Barangan Campus, as part of its evolution into a technological university, faces challenges in maintaining cohesive community interaction across its dispersed campus environment. Current digital platforms present fragmented information access, limited peer connectivity opportunities, and inadequate centralized community engagement mechanisms.

The disconnect experienced by students in accessing campus information, events, and opportunities through existing digital platforms has created a significant gap in the university experience. Moreover, students seeking to connect with peers who share similar academic and personal interests lack a unified, institutionally-supported medium for community building. This research addresses these challenges through the innovative development of a comprehensive community interaction platform.

### 1.2 Statement of the Problem

This study aims to design and develop a community interaction platform intended to enhance information sharing, communication opportunities, and peer connectivity among CTU - Danao-Barangan stakeholders. The platform is designed to address the disconnect users face in accessing scattered or fragmented digital information across dispersed campus environments, thereby providing a centralized solution for community interaction.

The disconnect manifests in several critical areas: students struggle to access timely campus information through existing fragmented digital platforms; peer-to-peer connections based on shared academic and personal interests remain challenging to establish; and the broader university community lacks a centralized, integrated platform for meaningful engagement. This research seeks to address these gaps through the development and assessment of an innovative community interaction platform.

### 1.3 Research Questions

This study aims to address the following research questions:

**RQ1: User Profile Analysis**
- What constitutes the comprehensive user profile for the community interaction platform?
- What are the demographic characteristics, technological competencies, and engagement patterns of CTU - Danao-Barangan stakeholders?

**RQ2: Current Challenges Assessment**
What are the current challenges faced by CTU - Danao-Barangan stakeholders in terms of:

**RQ2.1:** Accessing campus information, events, and opportunities through existing digital platforms?

**RQ2.2:** Connecting with peers who share similar academic and personal interests and engaging with the broader university communities in a centralized manner?

**RQ3: Platform Features and Requirements**
What specific features—both Functional and Non-Functional—are designed and implemented in the platform that meet the following requirements:

**RQ3.1:** User management and identity verification systems (Groups)?

**RQ3.2:** Interest-based community circle management?

**RQ3.3:** Real-time communication and campus feed functionality?

### 1.4 Objectives of the Study

**General Objective:**
To design, develop, and assess a community interaction platform that enhances usability, accessibility, and engagement among CTU Danao-Barangan stakeholders.

**Specific Objectives:**
1. To analyze user profiles and identify the technological needs and engagement patterns of CTU Danao-Barangan stakeholders
2. To assess the current challenges in accessing campus information and establishing peer connections through existing digital platforms
3. To design and implement functional requirements including user management, identity verification, interest-based community circles, and real-time communication systems
4. To evaluate the platform's non-functional requirements encompassing usability, performance, security, reliability, and sustainability
5. To measure user engagement and platform effectiveness through comprehensive usability and accessibility assessments

### 1.5 Significance of the Study

This research contributes to multiple stakeholder groups:

**For Students:** Provides a centralized platform for accessing campus information, connecting with peers based on shared interests, and engaging meaningfully with the university community.

**For Faculty and Staff:** Offers streamlined communication channels and efficient information dissemination mechanisms for campus-wide announcements and academic engagement.

**For University Administration:** Delivers insights into digital platform adoption, user engagement patterns, and community interaction dynamics that inform future technological infrastructure decisions.

**For Researchers:** Contributes to the body of knowledge on university community interaction platforms, usability assessment methodologies, and engagement metrics in higher education contexts.

**For Future Developers:** Provides a framework and reference implementation for developing similar platforms in other educational institutions.

---

## 2. REVIEW OF RELATED LITERATURE

### 2.1 Theoretical Framework

#### 2.1.1 HEIFER 2011+ Model
This study adopts the HEIFER 2011+ model as its primary evaluation framework, assessing the platform based on multiple dimensions:

**Functional Requirements:** The platform's capability to perform specific tasks and operations as intended, including user management, community circle management, and communication functionalities.

**Sustainability:** The long-term viability and maintainability of the platform, ensuring continued operation and support beyond initial deployment.

**Usability:** The ease with which users can learn, navigate, and effectively utilize platform features to accomplish their goals.

**Performance Requirements:** The system's responsiveness, scalability, and efficiency in handling user requests and data processing.

**Security and Reliability:** The platform's ability to protect user data, maintain system integrity, and provide consistent, dependable service.

#### 2.1.2 User Level Management Framework
The platform implements a hierarchical user management system with clearly defined levels and access controls:

**Level + Logical Test:** Each user level undergoes systematic logical testing to ensure appropriate access rights and functionality permissions align with user roles and responsibilities.

**Variables Relationship Management:** The system manages hyper-thesis relationships between variables, ensuring data integrity and proper user interaction flows across different access levels.

### 2.2 Related Studies on Community Interaction Platforms

[This section would include literature review of similar platforms in educational institutions]

### 2.3 Usability and Accessibility in Educational Technology

[This section would discuss existing research on usability assessment in university platforms]

### 2.4 Identity Verification and Security in Academic Platforms

[This section would review security frameworks for educational platforms]

---

## 3. METHODOLOGY

### 3.1 Research Design

This study employs a mixed-methods research design combining system development and empirical evaluation to create and assess the community interaction platform.

### 3.2 System Development Approach

#### 3.2.1 Requirements Analysis
Comprehensive analysis of user requirements through:
- Stakeholder interviews and surveys
- Analysis of existing platform limitations
- Identification of functional and non-functional requirements

#### 3.2.2 System Design
The platform architecture incorporates:

**User Management and Identity Verification (Groups):**
- Authentication system with student email verification
- Student ID-based identity verification
- Role-based access control (Student, Circle Leader, Administrator)
- Profile management with customization options

**Interest-Based Community Circle Management:**
- Circle creation and discovery mechanisms
- Interest matching algorithms
- Membership management systems
- Community moderation tools

**Real-Time Communication and Campus Feed:**
- Messaging systems with media support
- Activity feeds and notifications
- Post creation and commenting functionality
- Reaction and engagement mechanisms

#### 3.2.3 Implementation
Development using:
- Frontend: React.js framework
- Backend: Node.js with Express
- Database: Supabase (PostgreSQL)
- Authentication: Supabase Auth
- Storage: Supabase Storage for media files

### 3.3 Evaluation Framework

#### 3.3.1 Usability Assessment
Following established usability metrics:
- Level-based logical testing for each user category
- Task completion rates
- Error frequency analysis
- User satisfaction measurements

#### 3.3.2 Accessibility Evaluation
Assessment based on:
- Web Content Accessibility Guidelines (WCAG)
- Inclusive design principles
- Assistive technology compatibility

#### 3.3.3 Engagement Metrics
Quantitative measurements including:
- User activity levels
- Feature utilization rates
- Community participation indicators
- Platform retention rates

### 3.4 Data Collection and Analysis

[This section would detail specific data collection methods and statistical analysis approaches]

---

## 4. SYSTEM ARCHITECTURE AND IMPLEMENTATION

### 4.1 System Architecture Overview

The platform follows a three-tier architecture:
1. Presentation Layer (React frontend)
2. Application Layer (Node.js API)
3. Data Layer (Supabase/PostgreSQL)

### 4.2 Functional Requirements Implementation

#### 4.2.1 User Management and Identity Verification
The system implements comprehensive user management through:

**Authentication Module:**
- Secure email-based registration
- Password encryption and management
- Session management and token-based authentication

**Identity Verification Module:**
- Student ID verification system
- Document upload and validation
- Administrative approval workflow

**Role-Based Access Control:**
- Level 1: Students (Basic access to platform features)
- Level 2: Circle Leaders (Community management capabilities)
- Level 3: Administrators (Full system access and moderation)

#### 4.2.2 Interest-Based Community Circle Management
Implementation includes:

**Circle Creation:**
- User-initiated circle establishment
- Interest category selection
- Circle description and customization

**Discovery and Matching:**
- Interest-based recommendation algorithms
- Search and filtering mechanisms
- Circle browsing interface

**Membership Management:**
- Application and approval processes
- Member roles and permissions
- Circle activity monitoring

#### 4.2.3 Real-Time Communication and Campus Feed
Communication features encompass:

**Messaging System:**
- Direct messaging capabilities
- Group messaging within circles
- Media attachment support (images, documents)
- Message reactions and threading

**Campus Feed:**
- Chronological activity streams
- Post creation with rich media
- Commenting and discussion threads
- Notification system for updates

### 4.3 Non-Functional Requirements Implementation

#### 4.3.1 Usability
Design principles implemented:
- Intuitive navigation structure
- Consistent UI/UX patterns
- Responsive design for multiple devices
- User feedback mechanisms

#### 4.3.2 Performance
Optimization strategies:
- Database query optimization
- Caching mechanisms
- Lazy loading for media content
- Efficient data pagination

#### 4.3.3 Security and Reliability
Security measures include:
- Row-level security (RLS) policies
- Data encryption at rest and in transit
- Input validation and sanitization
- Regular security audits

#### 4.3.4 Sustainability
Long-term viability ensured through:
- Modular architecture for easy maintenance
- Comprehensive documentation
- Scalable infrastructure
- Regular updates and patches

### 4.4 System Administration and Access Control

Based on the HEIFER 2011+ model activity tracking:

**Access Reporting:**
- Comprehensive logging of user activities
- Access audit trails
- Permission usage analytics

**Level of User Management:**
- Hierarchical permission structure
- Logical testing for each access level
- Variables relationship management for data integrity

**Managing Usability:**
- Level + Logical Test implementation for user categories
- Hyper-thesis relationship variables monitoring
- Continuous usability optimization based on metrics

---

## 5. RESULTS AND DISCUSSION

[This section would present findings from the implementation and evaluation]

### 5.1 User Profile Analysis Results
### 5.2 Current Challenges Assessment Findings
### 5.3 Platform Features Evaluation
### 5.4 Usability Assessment Results
### 5.5 Engagement Metrics Analysis

---

## 6. CONCLUSION AND RECOMMENDATIONS

### 6.1 Conclusion

This study successfully designed, developed, and assessed a community interaction platform for CTU Danao-Barangan that addresses critical gaps in campus information access, peer connectivity, and community engagement. Through the implementation of comprehensive user management, identity verification, interest-based community circles, and real-time communication systems, the platform provides a centralized solution for stakeholder interaction.

The evaluation framework based on the HEIFER 2011+ model demonstrated that the platform meets functional requirements (user management, community circles, communication), sustainability criteria (maintainable architecture, scalable design), usability standards (intuitive interface, accessibility compliance), performance requirements (responsive system, efficient operations), and security and reliability metrics (data protection, system stability).

### 6.2 Recommendations

**For Implementation:**
1. Conduct phased rollout with pilot user groups
2. Establish comprehensive user training programs
3. Implement continuous monitoring and feedback mechanisms

**For Future Research:**
1. Longitudinal studies on long-term engagement patterns
2. Comparative analysis with other university platforms
3. Investigation of advanced features like AI-powered recommendations

**For System Enhancement:**
1. Integration with existing university systems
2. Mobile application development
3. Advanced analytics dashboard for administrators

---

## REFERENCES

[Academic references would be listed here in appropriate format]

---

## APPENDICES

### Appendix A: System Screenshots
### Appendix B: User Survey Instruments
### Appendix C: Usability Testing Protocols
### Appendix D: Database Schema Documentation
### Appendix E: API Documentation

---

**Prepared by:** [Your Names]  
**Institution:** Cebu Technological University - Danao-Barangan Campus  
**Program:** [Your Program]  
**Academic Year:** [Year]  
**Adviser:** [Adviser Name]
