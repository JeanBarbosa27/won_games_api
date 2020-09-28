import React, { useState, useEffect, memo } from 'react';
import { Header } from '@buffetjs/custom';
import { Table } from '@buffetjs/core';
import styled from 'styled-components';
import axios from 'axios';

const Wrapper = styled.div`
  padding: 18px 30px;

  p {
    margin-top: 1rem;
  }
`;

const HomePage = () => {
  const [rows, setRows] = useState([]);
  const headers = [
    {
      name: 'Name',
      value: 'name'
    },
    {
      name: 'Description',
      value: 'description'
    },
    {
      name: 'URL',
      value: 'html_url'
    },
  ];

  useEffect(() => {
    axios.get('https://api.github.com/users/React-Avancado/repos')
      .then(response => setRows(response.data))
      .catch(e => strapi.notification.error(`teste: ${e}`))
  }, [])

  return (
    <Wrapper>
      <Header
        title={{ label: 'Repositories' }}
        content="A list of our repositories in React Avançado Udemy course"
      />
      <Table headers={headers} rows={rows} />
    </Wrapper>
  );
};

export default memo(HomePage);
