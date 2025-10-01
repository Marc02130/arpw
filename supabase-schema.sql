-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";

-- Create user_profile table
CREATE TABLE IF NOT EXISTS user_profile (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    grok_api_key TEXT, -- This should be encrypted in production
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create references table
CREATE TABLE IF NOT EXISTS references (
    file_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL DEFAULT 'reference' CHECK (document_type = 'reference'),
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 10485760), -- Max 10MB
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create examples table
CREATE TABLE IF NOT EXISTS examples (
    file_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL DEFAULT 'example' CHECK (document_type = 'example'),
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 10485760), -- Max 10MB
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reference_vectors table
CREATE TABLE IF NOT EXISTS reference_vectors (
    vector_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES references(file_id) ON DELETE CASCADE,
    vector vector(384), -- 384 dimensions for all-MiniLM-L6-v2
    chunk_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create example_vectors table
CREATE TABLE IF NOT EXISTS example_vectors (
    vector_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES examples(file_id) ON DELETE CASCADE,
    vector vector(384), -- 384 dimensions for all-MiniLM-L6-v2
    chunk_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_papers table
CREATE TABLE IF NOT EXISTS user_papers (
    paper_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    sections TEXT[] NOT NULL,
    paper_type TEXT NOT NULL CHECK (paper_type IN ('Empirical Study', 'Literature Review', 'Theoretical Paper', 'Case Study')),
    citation_style TEXT NOT NULL CHECK (citation_style IN ('APA', 'MLA', 'Chicago')),
    output_format TEXT NOT NULL CHECK (output_format IN ('word', 'markdown')),
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed'))
);

-- Create paper_references table
CREATE TABLE IF NOT EXISTS paper_references (
    paper_id UUID NOT NULL REFERENCES user_papers(paper_id) ON DELETE CASCADE,
    file_id UUID NOT NULL REFERENCES references(file_id) ON DELETE CASCADE,
    PRIMARY KEY (paper_id, file_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profile_user_id ON user_profile(user_id);
CREATE INDEX IF NOT EXISTS idx_references_user_id ON references(user_id);
CREATE INDEX IF NOT EXISTS idx_examples_user_id ON examples(user_id);
CREATE INDEX IF NOT EXISTS idx_reference_vectors_file_id ON reference_vectors(file_id);
CREATE INDEX IF NOT EXISTS idx_example_vectors_file_id ON example_vectors(file_id);
CREATE INDEX IF NOT EXISTS idx_user_papers_user_id ON user_papers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_papers_title_version ON user_papers(user_id, title, version);
CREATE INDEX IF NOT EXISTS idx_paper_references_paper_id ON paper_references(paper_id);

-- Create vector similarity indexes
CREATE INDEX IF NOT EXISTS idx_reference_vectors_vector ON reference_vectors USING ivfflat (vector vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_example_vectors_vector ON example_vectors USING ivfflat (vector vector_cosine_ops) WITH (lists = 100);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE references ENABLE ROW LEVEL SECURITY;
ALTER TABLE examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_vectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE example_vectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_references ENABLE ROW LEVEL SECURITY;

-- User profile policies
CREATE POLICY "Users can view own profile" ON user_profile
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON user_profile
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON user_profile
    FOR UPDATE USING (auth.uid() = user_id);

-- References policies
CREATE POLICY "Users can view own references" ON references
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own references" ON references
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own references" ON references
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own references" ON references
    FOR DELETE USING (auth.uid() = user_id);

-- Examples policies
CREATE POLICY "Users can view own examples" ON examples
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own examples" ON examples
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own examples" ON examples
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own examples" ON examples
    FOR DELETE USING (auth.uid() = user_id);

-- Reference vectors policies
CREATE POLICY "Users can view own reference vectors" ON reference_vectors
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM references 
            WHERE references.file_id = reference_vectors.file_id 
            AND references.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own reference vectors" ON reference_vectors
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM references 
            WHERE references.file_id = reference_vectors.file_id 
            AND references.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own reference vectors" ON reference_vectors
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM references 
            WHERE references.file_id = reference_vectors.file_id 
            AND references.user_id = auth.uid()
        )
    );

-- Example vectors policies
CREATE POLICY "Users can view own example vectors" ON example_vectors
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM examples 
            WHERE examples.file_id = example_vectors.file_id 
            AND examples.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own example vectors" ON example_vectors
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM examples 
            WHERE examples.file_id = example_vectors.file_id 
            AND examples.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own example vectors" ON example_vectors
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM examples 
            WHERE examples.file_id = example_vectors.file_id 
            AND examples.user_id = auth.uid()
        )
    );

-- User papers policies
CREATE POLICY "Users can view own papers" ON user_papers
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own papers" ON user_papers
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own papers" ON user_papers
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own papers" ON user_papers
    FOR DELETE USING (auth.uid() = user_id);

-- Paper references policies
CREATE POLICY "Users can view own paper references" ON paper_references
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_papers 
            WHERE user_papers.paper_id = paper_references.paper_id 
            AND user_papers.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own paper references" ON paper_references
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_papers 
            WHERE user_papers.paper_id = paper_references.paper_id 
            AND user_papers.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own paper references" ON paper_references
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_papers 
            WHERE user_papers.paper_id = paper_references.paper_id 
            AND user_papers.user_id = auth.uid()
        )
    );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at on user_profile
CREATE TRIGGER update_user_profile_updated_at 
    BEFORE UPDATE ON user_profile 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profile (user_id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
